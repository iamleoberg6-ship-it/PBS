// Nomes fictícios para candidatos e dirigentes gerados pela IA.
import { next, pick, type RngState } from '../rng';

const FIRST = [
  'Ana', 'Beatriz', 'Carla', 'Daniela', 'Elaine', 'Fernanda', 'Gabriela', 'Helena', 'Isabela', 'Juliana',
  'Larissa', 'Mariana', 'Natália', 'Patrícia', 'Renata', 'Sabrina', 'Tatiane', 'Vanessa', 'Yasmin', 'Rosângela',
  'André', 'Bruno', 'Carlos', 'Diego', 'Eduardo', 'Fábio', 'Gustavo', 'Henrique', 'Igor', 'João',
  'Lucas', 'Marcelo', 'Nelson', 'Otávio', 'Paulo', 'Rafael', 'Sérgio', 'Thiago', 'Vinícius', 'Wagner',
  'Cláudia', 'Simone', 'Márcia', 'Jorge', 'Roberto', 'Denise', 'Edson', 'Luciana', 'Antônio', 'Priscila',
];
const LAST = [
  'Almeida', 'Barbosa', 'Cardoso', 'Duarte', 'Esteves', 'Farias', 'Gonçalves', 'Holanda', 'Iório', 'Jardim',
  'Lacerda', 'Moreira', 'Nogueira', 'Pacheco', 'Queiroz', 'Rezende', 'Siqueira', 'Teixeira', 'Valadares', 'Xavier',
  'Amaral', 'Bezerra', 'Campos', 'Dantas', 'Freitas', 'Guimarães', 'Leme', 'Medeiros', 'Peixoto', 'Rangel',
  'Sampaio', 'Toledo', 'Vasconcelos', 'Brandão', 'Coutinho', 'Prado', 'Fontes', 'Aragão', 'Bastos', 'Quintela',
];
const NICK = ['da Saúde', 'do Bairro', 'Professor', 'Professora', 'do Esporte', 'da Zona Leste', 'da Zona Sul', 'Doutor', 'do Transporte', 'da Comunidade'];

export function fictionalName(rng: RngState): string {
  return `${pick(rng, FIRST)} ${pick(rng, LAST)}`;
}

export function ballotName(rng: RngState): string {
  const first = pick(rng, FIRST);
  if (next(rng) < 0.18) return `${first} ${pick(rng, NICK)}`;
  return `${first} ${pick(rng, LAST)}`;
}

export function randomBirthDate(rng: RngState, minYear: number, maxYear: number): string {
  const y = minYear + Math.floor(next(rng) * (maxYear - minYear + 1));
  const m = 1 + Math.floor(next(rng) * 12);
  const d = 1 + Math.floor(next(rng) * 28);
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
