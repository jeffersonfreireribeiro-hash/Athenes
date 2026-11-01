// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — Motor de Grafo de Conhecimento e Conexões Bibliográficas.
 * Mapeia relações entre obras, autores, temas, veículos e anos com tratamento de dados ausentes.
 */

export function construirGrafoConexoes(referencias = []) {
  const nos = new Map();
  const arestas = [];
  const arestasChaves = new Set();

  function addNo(id, rotulo, tipo, extras = {}) {
    if (!nos.has(id)) {
      nos.set(id, {
        id,
        rotulo: rotulo || '(Não informado)',
        tipo, // 'obra', 'autor', 'tema', 'ano', 'veiculo', 'local'
        grau: 0,
        dadoAusente: Boolean(extras.dadoAusente),
        metadados: extras
      });
    }
    const no = nos.get(id);
    no.grau++;
    return no;
  }

  function addAresta(origemId, destinoId, tipoRelacao, peso = 1) {
    const k1 = `${origemId}->${destinoId}:${tipoRelacao}`;
    const k2 = `${destinoId}->${origemId}:${tipoRelacao}`;
    if (arestasChaves.has(k1) || arestasChaves.has(k2)) return;

    arestasChaves.add(k1);
    arestas.push({
      origem: origemId,
      destino: destinoId,
      tipo: tipoRelacao, // 'autoria', 'tematica', 'cronologia', 'veiculacao'
      peso
    });
  }

  for (const ref of referencias) {
    const obraId = `obra_${ref.id || ref.chave}`;
    const obraRotulo = ref.titulo?.length > 40 ? ref.titulo.slice(0, 37) + '...' : ref.titulo;
    addNo(obraId, obraRotulo, 'obra', { tituloCompleto: ref.titulo, ano: ref.ano, doi: ref.doi });

    // 1. Autores
    const autores = ref.autores || [];
    if (autores.length === 0) {
      const ausenteId = 'autor_ausente';
      addNo(ausenteId, 'Autoria não informada', 'autor', { dadoAusente: true });
      addAresta(obraId, ausenteId, 'autoria');
    } else {
      for (const a of autores) {
        const nomeCompleto = a.prenome ? `${a.prenome} ${a.sobrenome}` : a.sobrenome;
        const autorId = `autor_${nomeCompleto.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
        addNo(autorId, nomeCompleto, 'autor', { sobrenome: a.sobrenome });
        addAresta(obraId, autorId, 'autoria');
      }

      // Conexões de coautoria entre autores da mesma obra
      if (autores.length > 1) {
        for (let i = 0; i < autores.length; i++) {
          for (let j = i + 1; j < autores.length; j++) {
            const idA = `autor_${(autores[i].prenome ? autores[i].prenome + ' ' + autores[i].sobrenome : autores[i].sobrenome).toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
            const idB = `autor_${(autores[j].prenome ? autores[j].prenome + ' ' + autores[j].sobrenome : autores[j].sobrenome).toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
            addAresta(idA, idB, 'coautoria', 1.5);
          }
        }
      }
    }

    // 2. Anos
    if (ref.ano) {
      const anoId = `ano_${ref.ano}`;
      addNo(anoId, String(ref.ano), 'ano');
      addAresta(obraId, anoId, 'cronologia');
    } else {
      const semAnoId = 'ano_ausente';
      addNo(semAnoId, 'Ano não informado', 'ano', { dadoAusente: true });
      addAresta(obraId, semAnoId, 'cronologia');
    }

    // 3. Temas / Palavras-chave
    const temas = ref.palavrasChave || [];
    if (temas.length === 0) {
      const semTemaId = 'tema_ausente';
      addNo(semTemaId, 'Sem palavras-chave', 'tema', { dadoAusente: true });
      addAresta(obraId, semTemaId, 'tematica');
    } else {
      for (const t of temas) {
        const temaLimpo = t.trim();
        if (!temaLimpo) continue;
        const temaId = `tema_${temaLimpo.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
        addNo(temaId, temaLimpo, 'tema');
        addAresta(obraId, temaId, 'tematica');
      }
    }

    // 4. Periódico / Veículo
    if (ref.publicacao || ref.revista || ref.editora) {
      const veiculoNome = (ref.publicacao || ref.revista || ref.editora).trim();
      const veiculoId = `veic_${veiculoNome.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
      addNo(veiculoId, veiculoNome, 'veiculo');
      addAresta(obraId, veiculoId, 'veiculacao');
    }

    // 5. Local / País (com verificação de presença)
    if (ref.local || ref.cidade || ref.pais) {
      const localNome = (ref.pais || ref.local || ref.cidade).trim();
      const localId = `loc_${localNome.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
      addNo(localId, localNome, 'local');
      addAresta(obraId, localId, 'localidade');
    } else {
      const semLocalId = 'local_ausente';
      addNo(semLocalId, 'País/Local não determinado', 'local', { dadoAusente: true });
      addAresta(obraId, semLocalId, 'localidade');
    }
  }

  // Estatísticas de confiabilidade de dados
  let totalNos = nos.size;
  let dadosAusentes = 0;
  for (const n of nos.values()) {
    if (n.dadoAusente) dadosAusentes++;
  }

  return {
    nos: Array.from(nos.values()),
    arestas,
    totalReferencias: referencias.length,
    dadosAusentes,
    indiceCompletude: totalNos > 0 ? Math.round(((totalNos - dadosAusentes) / totalNos) * 100) : 100
  };
}
