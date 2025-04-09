const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const app = express();
const port = 3000;

// Configuração do MySQL
let db;
try {
  db = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '102030',
    database: 'TESTE',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });

  // Testar a conexão
  db.getConnection()
    .then(conn => {
      console.log('Conexão com o MySQL estabelecida com sucesso!');
      conn.release();
    })
    .catch(err => {
      console.error('Erro ao conectar ao MySQL:', err);
      process.exit(1);
    });
} catch (err) {
  console.error('Erro ao criar pool de conexão:', err);
  process.exit(1);
}

// Middleware
app.use(cors({
  origin: ['http://127.0.0.1:5500', 'http://localhost'],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
}));

app.use(express.json());

// Rotas
app.get('/api/test', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT 1 + 1 AS solution');
    res.json({ server: 'OK', database: 'OK', solution: rows[0].solution });
  } catch (error) {
    res.status(500).json({ server: 'OK', database: 'ERROR', error: error.message });
  }
});

app.get('/api/atividades', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM atividades');
    res.json(rows);
  } catch (error) {
    console.error('Erro ao buscar atividades:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/atividades', async (req, res) => {
  if (!Array.isArray(req.body)) {
    return res.status(400).json({ error: 'O corpo da requisição deve ser um array' });
  }

  try {
    const conn = await db.getConnection();
    let inserted = 0;
    let skipped = 0;
    
    try {
      for (const atividade of req.body) {
        const datas = Array.isArray(atividade.datasAtividadeIndividual) 
          ? atividade.datasAtividadeIndividual 
          : (atividade.datasAtividadeIndividual ? atividade.datasAtividadeIndividual.split(';') : []);
        
        for (const data of datas) {
          if (!data) continue;
          
          const [existing] = await conn.query(
            `SELECT * FROM atividades WHERE 
             descricao = ? AND 
             nomePessoalAtribuido = ? AND 
             datasAtividadeIndividual = ?`,
            [atividade.descricao, atividade.nomePessoalAtribuido, data]
          );

          if (existing.length === 0) {
            await conn.query(
              `INSERT INTO atividades SET ?`,
              {
                descricao: atividade.descricao,
                nomePessoalAtribuido: atividade.nomePessoalAtribuido,
                horaInicioAgendada: atividade.horaInicioAgendada || '',
                fimAgendado: atividade.fimAgendado || '',
                datasAtividadeIndividual: data,
                confirmada: false
              }
            );
            inserted++;
          } else {
            skipped++;
          }
        }
      }
      conn.release();
      res.json({ success: true, inserted, skipped });
    } catch (error) {
      conn.release();
      console.error('Erro ao inserir atividade:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  } catch (error) {
    console.error('Erro geral:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/atividades/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      descricao, 
      nomePessoalAtribuido, 
      horaInicioAgendada, 
      fimAgendado,
      datasAtividadeIndividual
    } = req.body;

    // Validação básica
    if (!descricao || !nomePessoalAtribuido || !horaInicioAgendada || !fimAgendado) {
      return res.status(400).json({ error: 'Campos obrigatórios faltando' });
    }

    const [result] = await db.query(
      `UPDATE atividades SET 
        descricao = ?,
        nomePessoalAtribuido = ?,
        horaInicioAgendada = ?,
        fimAgendado = ?,
        datasAtividadeIndividual = ?
      WHERE id = ?`,
      [
        descricao,
        nomePessoalAtribuido,
        horaInicioAgendada,
        fimAgendado,
        Array.isArray(datasAtividadeIndividual) ? datasAtividadeIndividual.join(';') : datasAtividadeIndividual,
        id
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Atividade não encontrada' });
    }

    // Retorna a atividade atualizada
    const [updated] = await db.query('SELECT * FROM atividades WHERE id = ?', [id]);
    res.json({ success: true, atividade: updated[0] });
  } catch (error) {
    console.error('Erro ao atualizar atividade:', error);
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/atividades/:id/confirmar', async (req, res) => {
  try {
    const { id } = req.params;
    const { confirmada } = req.body;

    const [result] = await db.query(
      'UPDATE atividades SET confirmada = ? WHERE id = ?',
      [confirmada, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Atividade não encontrada' });
    }

    res.json({ success: true, message: 'Status de confirmação atualizado' });
  } catch (error) {
    console.error('Erro ao confirmar aula:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/atividades/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [result] = await db.query('DELETE FROM atividades WHERE id = ?', [id]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Atividade não encontrada' });
    }
    
    res.json({ success: true, message: 'Atividade excluída com sucesso' });
  } catch (error) {
    console.error('Erro ao excluir atividade:', error);
    res.status(500).json({ error: error.message });
  }
});

// Iniciar servidor
app.listen(port, () => {
  console.log(`Servidor rodando em http://localhost:${port}`);
});