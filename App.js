import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TextInput, ScrollView, TouchableOpacity, Alert, SafeAreaView, StatusBar } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

// =========================================================================
// PAINEL DE CONTROLE - AQUI VOCÊ MANDA NA ORDEM E NOS ITENS!
// =========================================================================

// 1. ORDEM DAS ABAS: Mude a ordem das palavras abaixo para mudar as abas no topo do App.
const ORDEM_DAS_ABAS = [
  "Crianças", 
  "Gestantes", 
  "Puerpéra", 
  "Mulheres", 
  "Idosos", 
  "Adolescentes", 
  "Crônicos", 
  "Óbitos"
];

// 2. ITENS DE CADA ABA: Adicione ou remova itens entre aspas.
const ESTRUTURA_DADOS = {
  "Crianças": ["Nascidos vivos", "Consulta até 30 dias", "Vacina em dia", "Peso baixo ao nascer"],
  "Gestantes": ["Pré-natal iniciado", "7 consultas realizadas", "Consulta Odonto", "Vacina em dia"],
  "Puerpéra": ["Visita até 42 dias", "Consulta Puerperal"],
  "Mulheres": ["Preventivo 25-64 anos", "Mamografia 50-69 anos", "Saúde Sexual"],
  "Idosos": ["Consulta 12 meses", "Avaliação IVCF-20", "Vacina Influenza", "Visita ACS"],
  "Adolescentes": ["Vacina HPV", "Vacina Meningo ACWY", "Atendimento Individual"],
  "Crônicos": ["Diabéticos Visitados", "Hipertensos Acompanhados", "Aferição de PA", "Glicemia"],
  "Óbitos": ["Óbito Fetal", "Óbito Materno", "Óbito menor de 1 ano", "Total de Óbitos"]
};

// =========================================================================

export default function App() {
  const [abaAtiva, setAbaAtiva] = useState(ORDEM_DAS_ABAS[0]);
  const [dados, setDados] = useState({});

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    try {
      const salvo = await AsyncStorage.getItem('@producao_v2');
      if (salvo) setDados(JSON.parse(salvo));
    } catch (e) { console.log(e); }
  };

  const atualizarValor = async (aba, item, valor) => {
    const novosDados = { ...dados, [aba]: { ...(dados[aba] || {}), [item]: valor } };
    setDados(novosDados);
    await AsyncStorage.setItem('@producao_v2', JSON.stringify(novosDados));
  };

  const gerarPDF = async () => {
    let html = `<h1>Produção Mensal de Saúde</h1><table border="1" style="width:100%; border-collapse:collapse;">`;
    ORDEM_DAS_ABAS.forEach(aba => {
      html += `<tr style="background:#ddd"><th colspan="2">${aba}</th></tr>`;
      ESTRUTURA_DADOS[aba].forEach(item => {
        const val = (dados[aba] && dados[aba][item]) || '0';
        html += `<tr><td style="padding:8px">${item}</td><td style="text-align:center">${val}</td></tr>`;
      });
    });
    html += `</table>`;
    const { uri } = await Print.printToFileAsync({ html });
    await Sharing.shareAsync(uri);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor="#0284c7" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Produção ACS Offline</Text>
        <TouchableOpacity style={styles.btnPdf} onPress={gerarPDF}>
          <Text style={styles.btnPdfText}>📄 Gerar PDF</Text>
        </TouchableOpacity>
      </View>

      {/* MENU DE ABAS CONFIGURÁVEL */}
      <View style={styles.tabBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {ORDEM_DAS_ABAS.map(aba => (
            <TouchableOpacity 
              key={aba} 
              style={[styles.tabItem, abaAtiva === aba && styles.tabItemAtivo]}
              onPress={() => setAbaAtiva(aba)}
            >
              <Text style={[styles.tabText, abaAtiva === aba && styles.tabTextAtivo]}>{aba}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* FORMULÁRIO */}
      <ScrollView style={styles.formArea}>
        <Text style={styles.secaoTitulo}>{abaAtiva}</Text>
        {ESTRUTURA_DADOS[abaAtiva].map(item => (
          <View key={item} style={styles.inputGroup}>
            <Text style={styles.label}>{item}</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              placeholder="0"
              value={dados[abaAtiva]?.[item] || ''}
              onChangeText={(txt) => atualizarValor(abaAtiva, item, txt)}
            />
          </View>
        ))}
        <View style={{ height: 50 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  header: { backgroundColor: '#0284c7', padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  btnPdf: { backgroundColor: '#0ea5e9', padding: 8, borderRadius: 5 },
  btnPdfText: { color: 'white', fontWeight: 'bold' },
  tabBar: { backgroundColor: 'white', height: 50, borderBottomWidth: 1, borderColor: '#e2e8f0' },
  tabItem: { paddingHorizontal: 20, justifyContent: 'center', borderBottomWidth: 3, borderBottomColor: 'transparent' },
  tabItemAtivo: { borderBottomColor: '#0284c7' },
  tabText: { color: '#64748b', fontWeight: '500' },
  tabTextAtivo: { color: '#0284c7', fontWeight: 'bold' },
  formArea: { flex: 1, padding: 15 },
  secaoTitulo: { fontSize: 22, fontWeight: 'bold', color: '#1e293b', marginBottom: 20 },
  inputGroup: { backgroundColor: 'white', padding: 15, borderRadius: 10, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', elevation: 2 },
  label: { flex: 1, fontSize: 16, color: '#334155' },
  input: { backgroundColor: '#f8fafc', width: 70, height: 45, borderRadius: 5, textAlign: 'center', fontSize: 18, fontWeight: 'bold', borderWidth: 1, borderColor: '#cbd5e1' }
});
