// Dias da semana (0 = Domingo, 1 = Segunda, etc.)
const diasDaSemana = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
const hoje = new Date();

// Ajusta para a segunda-feira da semana atual
const primeiraData = new Date(hoje);
primeiraData.setDate(hoje.getDate() - hoje.getDay() + 1);

// Configurações de horário
const HORA_INICIO = 7; // Primeira hora do calendário (7h)
const ALTURA_HORA = 60; // Altura em pixels de cada hora

// Função para gerar uma cor baseada no hash de uma string
function getCorParaMateria(nomeMateria) {
  const cores = [
    '#FFD1DC', '#B5EAD7', '#C7CEEA', '#E2F0CB', '#FFDAC1',
    '#F8B195', '#F67280', '#C06C84', '#6C5B7B', '#355C7D',
    '#A8E6CE', '#DCEDC2', '#FFD3B5', '#FFAAA6', '#FF8C94',
    '#A2D7D8', '#BCC4DB', '#C1BBDD', '#D4A5A5', '#E0BBE4'
  ];
  
  let hash = 0;
  for (let i = 0; i < nomeMateria.length; i++) {
    hash = nomeMateria.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  const index = Math.abs(hash) % cores.length;
  return cores[index];
}

function escurecerCor(cor, percentual) {
  let r = parseInt(cor.substring(1, 3), 16);
  let g = parseInt(cor.substring(3, 5), 16);
  let b = parseInt(cor.substring(5, 7), 16);

  r = Math.floor(r * (100 - percentual) / 100);
  g = Math.floor(g * (100 - percentual) / 100);
  b = Math.floor(b * (100 - percentual) / 100);

  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

function calcularPosicaoEvento(horaInicio, horaFim) {
  const inicioDecimal = horaInicio.getHours() + (horaInicio.getMinutes() / 60);
  const fimDecimal = horaFim.getHours() + (horaFim.getMinutes() / 60);
  
  const top = (inicioDecimal - HORA_INICIO) * ALTURA_HORA;
  const height = (fimDecimal - inicioDecimal) * ALTURA_HORA;
  
  return { top, height };
}

function atualizarDatas() {
  const dias = document.querySelectorAll('.dia');
  dias.forEach((dia, index) => {
    const dataAtual = new Date(primeiraData);
    dataAtual.setDate(primeiraData.getDate() + index);
    
    dia.querySelector('.numero-data').textContent = dataAtual.getDate();
    
    if (dataAtual.toDateString() === hoje.toDateString()) {
      dia.style.backgroundColor = '#f5f5f5';
    }
  });
}

function processarDatasAtividade(datasString) {
  if (!datasString) return [];
  if (Array.isArray(datasString)) return datasString;
  return datasString.split(';').map(date => date.trim());
}

function parseTimeToDate(timeStr) {
  if (!timeStr) return null;

  const timeParts = timeStr.split(':');
  if (timeParts.length >= 2) {
    const hours = parseInt(timeParts[0]);
    const minutes = parseInt(timeParts[1]);

    if (isNaN(hours)) return null;

    const date = new Date();
    date.setHours(hours, minutes || 0, 0, 0);
    return date;
  }
  return null;
}

function formatTime(timeStr) {
  if (!timeStr) return '';
  return timeStr.substring(0, 5);
}

// Função para organizar eventos sobrepostos
function organizarEventosSobrepostos(diaElement) {
  const eventos = Array.from(diaElement.querySelectorAll('.evento'));
  
  // Ordena eventos por horário de início
  eventos.sort((a, b) => parseFloat(a.style.top) - parseFloat(b.style.top));
  
  let grupos = [];
  let grupoAtual = [];
  let ultimoFim = 0;
  
  eventos.forEach((evento, index) => {
    const top = parseFloat(evento.style.top);
    const height = parseFloat(evento.style.height);
    const fim = top + height;
    
    if (top >= ultimoFim) {
      if (grupoAtual.length > 0) grupos.push(grupoAtual);
      grupoAtual = [evento];
      ultimoFim = fim;
    } else {
      grupoAtual.push(evento);
      ultimoFim = Math.max(ultimoFim, fim);
    }
    
    if (index === eventos.length - 1) grupos.push(grupoAtual);
  });
  
  grupos.forEach(grupo => {
    if (grupo.length > 1) {
      const largura = 90 / grupo.length;
      grupo.forEach((evento, i) => {
        evento.style.width = `${largura}%`;
        evento.style.left = `${5 + (i * largura)}%`;
        evento.style.zIndex = i + 1;
      });
    } else if (grupo.length === 1) {
      grupo[0].style.width = '95%';
      grupo[0].style.left = '2.5%';
    }
  });
}

async function fetchActivities() {
  try {
    const response = await fetch('http://localhost:3000/api/atividades');
    const activities = await response.json();

    document.querySelectorAll('.eventos').forEach(el => el.innerHTML = '');

    // Primeiro adiciona todos os eventos
    const promises = activities.map(activity => {
      const datasAtividade = processarDatasAtividade(activity.datasAtividadeIndividual);

      return Promise.all(datasAtividade.map(dataStr => {
        if (!dataStr) return Promise.resolve();

        try {
          const dataAtividade = new Date(dataStr);
          if (isNaN(dataAtividade.getTime())) return Promise.resolve();

          const diaSemana = dataAtividade.getDay();
          if (diaSemana === 0) return Promise.resolve();

          const diaElement = document.querySelector(`.dia.${diasDaSemana[diaSemana]}`);
          if (!diaElement) return Promise.resolve();

          const numeroData = parseInt(diaElement.querySelector('.numero-data').textContent);
          if (dataAtividade.getDate() !== numeroData) return Promise.resolve();

          const horaInicio = parseTimeToDate(activity.horaInicioAgendada);
          const horaFim = parseTimeToDate(activity.fimAgendado);

          if (!horaInicio || !horaFim) return Promise.resolve();

          const { top, height } = calcularPosicaoEvento(horaInicio, horaFim);

          const eventoDiv = document.createElement('div');
          eventoDiv.className = 'evento';

          const corMateria = getCorParaMateria(activity.descricao);
          eventoDiv.style.backgroundColor = corMateria;
          eventoDiv.style.borderLeftColor = escurecerCor(corMateria, 20);

          eventoDiv.style.top = `${top}px`;
          eventoDiv.style.height = `${height}px`;

          const horaInicioFormatada = formatTime(activity.horaInicioAgendada);
          const horaFimFormatada = formatTime(activity.fimAgendado);

          eventoDiv.innerHTML = `
            <p class="titulo">${activity.descricao}</p>
            <p class="horario">${horaInicioFormatada} - ${horaFimFormatada}</p>
            <p class="professor">${activity.nomePessoalAtribuido}</p>
          `;

          diaElement.querySelector('.eventos').appendChild(eventoDiv);
          return Promise.resolve();
        } catch (e) {
          console.error('Erro ao processar atividade:', e);
          return Promise.resolve();
        }
      }));
    });

    // Depois que todos os eventos foram adicionados, organiza os sobrepostos
    await Promise.all(promises);
    document.querySelectorAll('.dia').forEach(dia => {
      organizarEventosSobrepostos(dia);
    });

  } catch (error) {
    console.error('Erro ao buscar atividades:', error);
    alert('Erro ao carregar os horários. Por favor, recarregue a página.');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  atualizarDatas();
  fetchActivities();
});


// Variável global para armazenar a atividade selecionada
let atividadeSelecionada = null;

// Adicione esta função para mostrar o modal
function mostrarModalEdicao(atividade) {
  atividadeSelecionada = atividade;
  const modal = document.getElementById('modalEdicao');
  const detalhes = document.getElementById('detalhesAula');
  
  detalhes.innerHTML = `
    <p><strong>Matéria:</strong> ${atividade.descricao}</p>
    <p><strong>Professor:</strong> ${atividade.nomePessoalAtribuido}</p>
    <p><strong>Horário:</strong> ${formatTime(atividade.horaInicioAgendada)} - ${formatTime(atividade.fimAgendado)}</p>
    <p><strong>Data:</strong> ${new Date(atividade.datasAtividadeIndividual[0]).toLocaleDateString()}</p>
  `;
  
  modal.style.display = 'flex';
}

// Adicione estas funções para manipular os eventos
function configurarEventosModal() {
  const modal = document.getElementById('modalEdicao');
  const btnCancelar = document.getElementById('btnCancelar');
  const btnEditar = document.getElementById('btnEditar');
  const btnExcluir = document.getElementById('btnExcluir');
  
  // Fechar modal ao clicar no botão cancelar ou fora do conteúdo
  btnCancelar.addEventListener('click', () => {
    modal.style.display = 'none';
  });
  
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.style.display = 'none';
    }
  });
  
  // Implementar função de edição
  btnEditar.addEventListener('click', () => {
    alert(`Editar aula: ${atividadeSelecionada.descricao}`);
    // Aqui você pode implementar a lógica de edição
    modal.style.display = 'none';
  });
  
  // Implementar função de exclusão
  btnExcluir.addEventListener('click', () => {
    if (confirm(`Tem certeza que deseja excluir a aula "${atividadeSelecionada.descricao}"?`)) {
      // Aqui você pode implementar a lógica de exclusão
      alert(`Aula "${atividadeSelecionada.descricao}" excluída com sucesso!`);
      modal.style.display = 'none';
      // Recarregar as atividades
      fetchActivities();
    }
  });
}

// Modifique a criação do evento para adicionar o clique
function criarElementoEvento(activity, diaElement) {
  const horaInicio = parseTimeToDate(activity.horaInicioAgendada);
  const horaFim = parseTimeToDate(activity.fimAgendado);
  
  if (!horaInicio || !horaFim) return null;

  const { top, height } = calcularPosicaoEvento(horaInicio, horaFim);
  const horaInicioFormatada = formatTime(activity.horaInicioAgendada);
  const horaFimFormatada = formatTime(activity.fimAgendado);
  const corMateria = getCorParaMateria(activity.descricao);

  const eventoDiv = document.createElement('div');
  eventoDiv.className = 'evento';
  eventoDiv.style.backgroundColor = corMateria;
  eventoDiv.style.borderLeftColor = escurecerCor(corMateria, 20);
  eventoDiv.style.top = `${top}px`;
  eventoDiv.style.height = `${height}px`;

  eventoDiv.innerHTML = `
    <p class="titulo">${activity.descricao}</p>
    <p class="horario">${horaInicioFormatada} - ${horaFimFormatada}</p>
    <p class="professor">${activity.nomePessoalAtribuido}</p>
  `;

  // Adiciona o evento de clique
  eventoDiv.addEventListener('click', (e) => {
    e.stopPropagation();
    mostrarModalEdicao(activity);
  });

  return eventoDiv;
}

// Atualize a função fetchActivities para usar a nova função de criação
async function fetchActivities() {
  try {
    const response = await fetch('http://localhost:3000/api/atividades');
    const activities = await response.json();

    document.querySelectorAll('.eventos').forEach(el => el.innerHTML = '');

    activities.forEach(activity => {
      const datasAtividade = processarDatasAtividade(activity.datasAtividadeIndividual);

      datasAtividade.forEach(dataStr => {
        if (!dataStr) return;

        try {
          const dataAtividade = new Date(dataStr);
          if (isNaN(dataAtividade.getTime())) return;

          const diaSemana = dataAtividade.getDay();
          if (diaSemana === 0) return;

          const diaElement = document.querySelector(`.dia.${diasDaSemana[diaSemana]}`);
          if (!diaElement) return;

          const numeroData = parseInt(diaElement.querySelector('.numero-data').textContent);
          if (dataAtividade.getDate() !== numeroData) return;

          const eventoDiv = criarElementoEvento(activity, diaElement);
          if (eventoDiv) {
            diaElement.querySelector('.eventos').appendChild(eventoDiv);
          }
        } catch (e) {
          console.error('Erro ao processar atividade:', e);
        }
      });
    });

    // Organiza os eventos sobrepostos
    document.querySelectorAll('.dia').forEach(dia => {
      organizarEventosSobrepostos(dia);
    });

  } catch (error) {
    console.error('Erro ao buscar atividades:', error);
    alert('Erro ao carregar os horários. Por favor, recarregue a página.');
  }
}

// Adicione esta chamada no final do DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
  atualizarDatas();
  fetchActivities();
  configurarEventosModal(); // Configura os eventos do modal
});