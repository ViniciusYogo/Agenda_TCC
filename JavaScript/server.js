const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const app = express();
const port = 3000;

// Configuração do MySQL com tratamento de erro melhorado
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

  // Testar a conexão imediatamente
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
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
}));

app.options('*', cors());
app.use(express.json());

// Rota de teste do servidor
app.get('/api/test', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT 1 + 1 AS solution');
    res.json({ server: 'OK', database: 'OK', solution: rows[0].solution });
  } catch (error) {
    res.status(500).json({ server: 'OK', database: 'ERROR', error: error.message });
  }
});

// Rota de teste de conexão com o banco
app.get('/api/test-db', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT 1 + 1 AS result');
    res.json({ dbStatus: 'OK', result: rows[0].result });
  } catch (error) {
    console.error('Erro no teste do banco:', error);
    res.status(500).json({ dbStatus: 'ERROR', error: error.message });
  }
});

// Rota para buscar atividades
app.get('/api/atividades', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM atividades');
    res.json(rows);
  } catch (error) {
    console.error('Erro ao buscar atividades:', error);
    res.status(500).json({ error: error.message });
  }
});

// Rota principal para inserir atividades
app.post('/api/atividades', async (req, res) => {
  console.log('Dados recebidos:', req.body);

  if (!Array.isArray(req.body)) {
    return res.status(400).json({ error: 'O corpo da requisição deve ser um array' });
  }

  try {
    const conn = await db.getConnection();
    let inserted = 0;
    let skipped = 0;
    
    try {
      for (const atividade of req.body) {
        // Garante que datasAtividadeIndividual seja tratada corretamente
        const datas = Array.isArray(atividade.datasAtividadeIndividual) 
          ? atividade.datasAtividadeIndividual 
          : (atividade.datasAtividadeIndividual ? atividade.datasAtividadeIndividual.split(';') : []);
        
        for (const data of datas) {
          if (!data) continue; // Pula datas vazias
          
          // Verifica se já existe um registro com a mesma descrição, professor e data
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
                diasAgendados: atividade.diasAgendados || '',
                horaInicioAgendada: atividade.horaInicioAgendada || '',
                fimAgendado: atividade.fimAgendado || '',
                datasAtividadeIndividual: data,
                descricaoLocalizacaoAtribuida: atividade.descricaoLocalizacaoAtribuida || ''
              }
            );
            inserted++;
          } else {
            skipped++;
          }
        }
      }
      conn.release();
      res.json({ 
        success: true, 
        inserted, 
        skipped,
        message: `Atividades processadas com sucesso! Inseridas: ${inserted}, Ignoradas: ${skipped}`
      });
    } catch (insertError) {
      conn.release();
      console.error('Erro ao inserir atividade:', insertError);
      res.status(500).json({ 
        success: false, 
        inserted,
        skipped,
        error: insertError.message 
      });
    }
  } catch (error) {
    console.error('Erro geral:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Rota para limpar todas as atividades (APENAS PARA DESENVOLVIMENTO)
app.delete('/api/atividades', async (req, res) => {
  if (process.env.NODE_ENV !== 'development') {
    return res.status(403).json({ error: 'Operação não permitida em produção' });
  }
  
  try {
    const [result] = await db.query('DELETE FROM atividades');
    res.json({ 
      success: true, 
      deleted: result.affectedRows,
      message: `Todas as atividades (${result.affectedRows}) foram removidas`
    });
  } catch (error) {
    console.error('Erro ao limpar atividades:', error);
    res.status(500).json({ error: error.message });
  }
});

// Iniciar servidor
app.listen(port, () => {
  console.log(`Servidor rodando em http://localhost:${port}`);
  console.log('Rotas disponíveis:');
  console.log(`- GET  http://localhost:${port}/api/test`);
  console.log(`- GET  http://localhost:${port}/api/test-db`);
  console.log(`- GET  http://localhost:${port}/api/atividades`);
  console.log(`- POST http://localhost:${port}/api/atividades`);
  if (process.env.NODE_ENV === 'development') {
    console.log(`- DELETE http://localhost:${port}/api/atividades (APENAS DESENVOLVIMENTO)`);
  }
});