import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, Text, View, TextInput, ScrollView, 
  TouchableOpacity, Alert, SafeAreaView, StatusBar 
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';

// Estrutura completa baseada na sua planilha de produção
import { DICIONARIO_PRODUCAO } from './estruturaDados'; 

export default function App() {
  const [mesAno, setMesAno] = useState(''); // Ex: "06/2026"
  const [dados, setDados] = useState({});
  const [categoriaAtiva, setCategoriaAtiva] = useState(Object.keys(DICIONARIO_PRODUCAO)[0]);

  // Define o mês atual como padrão ao abrir o app
  useEffect(() => {
    const dataAtual = new Date();
    const mes = String(dataAtual.getMonth() + 1).padStart(2, '0');
    const ano = dataAtual.getFullYear();
    setMesAno(`${mes}/${ano}`);
  }, []);

  // Carrega os dados sempre que o Mês/Ano mudar
  useEffect(() => {
    if (mesAno) {
      carregarDadosDoMes(mesAno);
    }
  }, [mesAno]);

  const carregarDadosDoMes = async (chaveMes) => {
    try {
      const dadosSalvos = await AsyncStorage.getItem(`@producao_${chaveMes}`);
      if (dadosSalvos) {
        setDados(JSON.parse(dadosSalvos));
      } else {
        setDados({});
      }
    } catch (e) {
      Alert.alert('Erro', 'Não foi possível carregar os dados locais.');
    }
  };

  // Salva automaticamente ao alterar um campo
  const handleInputChange = async (campo, valor) => {
    const novosDados = { ...dados, [campo]: valor };
    setDados(novosDados);
    try {
      await AsyncStorage.setItem(`@producao_${mesAno}`, JSON.stringify(novosDados));
    } catch (e) {
      console.error('Erro ao salvar dado', e);
    }
  };

  // 1. GERAR RELATÓRIO EM PDF
  const gerarPDF = async () => {
    let linhasHtml = '';
    
    Object.entries(DICIONARIO_PRODUCAO).forEach(([categoria, campos]) => {
      linhasHtml += `
        <tr style="background-color: #e67e22; color: white; font-weight: bold;">
          <td colspan="2" style="padding: 8px; font-size: 14px;">${categoria}</td>
        </tr>
      `;
      campos.forEach(campo => {
        const valor = dados[campo] || '0';
        linhasHtml += `
          <tr style="border-bottom: 1px solid #ddd;">
            <td style="padding: 6px; font-size: 11px; width: 75%;">${campo}</td>
            <td style="padding: 6px; font-size: 12px; width: 25%; text-align: center; font-weight: bold;">${valor}</td>
          </tr>
        `;
      });
    });

    const htmlContent = `
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Helvetica, sans-serif; margin: 20px; color: #333; }
            h1 { text-align: center; color: #d35400; margin-bottom: 5px; font-size: 20px; }
            h2 { text-align: center; color: #555; margin-top: 0; font-size: 14px; margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { border: 1px solid #bdc3c7; text-align: left; }
          </style>
        </head>
        <body>
          <h1>PRODUÇÃO MENSAL DE SAÚDE</h1>
          <h2>Competência: ${mesAno}</h2>
          <table>
            <thead>
              <tr style="background-color: #2c3e50; color: white;">
                <th style="padding: 8px;">Indicador / Campo</th>
                <th style="padding: 8px; text-align: center;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${linhasHtml}
            </tbody>
          </table>
        </body>
      </html>
    `;

    try {
      const { uri } = await Print.printToFileAsync({ html: htmlContent });
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: `Producao_${mesAno}` });
    } catch (error) {
      Alert.alert('Erro', 'Falha ao gerar ou compartilhar PDF.');
    }
  };

  // 2. EXPORTAR BACKUP (JSON)
  const exportarBackupJSON = async () => {
    try {
      const chaves = await AsyncStorage.getAllKeys();
      const chavesProducao = chaves.filter(k => k.startsWith('@producao_'));
      const todasProducoes = await AsyncStorage.multiGet(chavesProducao);
      
      const objetoBackup = {};
      todasProducoes.forEach(([chave, valor]) => {
        objetoBackup[chave] = JSON.parse(valor);
      });

      const jsonString = JSON.stringify(objetoBackup, null, 2);
      const caminhoArquivo = `${FileSystem.documentDirectory}backup_producao_saude.json`;
      
      await FileSystem.writeAsStringAsync(caminhoArquivo, jsonString, { encoding: FileSystem.EncodingType.UTF8 });
      await Sharing.shareAsync(caminhoArquivo, { dialogTitle: 'Exportar Backup da Produção' });
    } catch (e) {
      Alert.alert('Erro', 'Não foi possível exportar o arquivo de backup.');
    }
  };

  // 3. IMPORTAR BACKUP (JSON)
  const importarBackupJSON = async () => {
    try {
      const resultado = await DocumentPicker.getDocumentAsync({ type: 'application/json' });
      if (resultado.canceled) return;

      const conteudoStr = await FileSystem.readAsStringAsync(resultado.assets[0].uri, { encoding: FileSystem.EncodingType.UTF8 });
      const dadosBackup = JSON.parse(conteudoStr);

      Alert.alert(
        'Confirmar Importação',
        'Isso irá substituir os dados atuais pelos dados do backup. Deseja continuar?',
        [
          { text: 'Cancelar', style: 'cancel' },
          { 
            text: 'Importar', 
            onPress: async () => {
              for (const [chave, valor] of Object.entries(dadosBackup)) {
                if (chave.startsWith('@producao_')) {
                  await AsyncStorage.setItem(chave, JSON.stringify(valor));
                }
              }
              if (mesAno) carregarDadosDoMes(mesAno);
              Alert.alert('Sucesso', 'Backup restaurado com sucesso!');
            }
          }
        ]
      );
    } catch (e) {
      Alert.alert('Erro', 'Arquivo inválido ou corrompido.');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#d35400" />
      
      {/* CABEÇALHO DO APP */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Produção do ACS</Text>
        <View style={styles.selectorContainer}>
          <Text style={styles.labelMes}>Mês/Ano:</Text>
          <TextInput 
            style={styles.inputMes}
            value={mesAno}
            onChangeText={setMesAno}
            placeholder="MM/AAAA"
            placeholderTextColor="#f39c12"
            keyboardType="numeric"
            maxLength={7}
          />
        </View>
      </View>

      {/* BOTÕES DE AÇÃO PRINCIPAL */}
      <View style={styles.actionRow}>
        <TouchableOpacity style={[styles.btnAction, styles.btnPdf]} onPress={gerarPDF}>
          <Text style={styles.btnText}>📄 PDF</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btnAction, styles.btnBackup]} onPress={exportarBackupJSON}>
          <Text style={styles.btnText}>📤 Exportar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btnAction, styles.btnBackup]} onPress={importarBackupJSON}>
          <Text style={styles.btnText}>📥 Importar</Text>
        </TouchableOpacity>
      </View>

      {/* SELETOR LATERAL/TOP DE CATEGORIAS */}
      <View style={{ height: 50 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryTabs}>
          {Object.keys(DICIONARIO_PRODUCAO).map((cat) => (
            <TouchableOpacity 
              key={cat} 
              style={[styles.tab, categoriaAtiva === cat && styles.tabAtiva]}
              onPress={() => setCategoriaAtiva(cat)}
            >
              <Text style={[styles.tabText, categoriaAtiva === cat && styles.tabTextAtiva]}>
                {cat.split(' (')[0]}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* FORMULÁRIO COM CAMPOS GRANDES */}
      <ScrollView style={styles.formContainer} keyboardShouldPersistTaps="handled">
        <Text style={styles.categoryTitle}>{categoriaAtiva}</Text>
        
        {DICIONARIO_PRODUCAO[categoriaAtiva].map((campo, index) => (
          <View key={index} style={styles.inputGroup}>
            <Text style={styles.inputLabel}>{campo}</Text>
            <TextInput 
              style={styles.inputValor}
              value={dados[campo] || ''}
              onChangeText={(val) => handleInputChange(campo, val)}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor="#999"
            />
          </View>
        ))}
        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ESTILOS FOCADOS EM ACESSIBILIDADE E CLAREZA VISUAL
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f5f6fa' },
  header: { 
    backgroundColor: '#d35400', 
    padding: 16, 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center' 
  },
  headerTitle: { color: 'white', fontSize: 22, fontWeight: 'bold' },
  selectorContainer: { flexDirection: 'row', alignItems: 'center' },
  labelMes: { color: 'white', marginRight: 8, fontSize: 16, fontWeight: '600' },
  inputMes: { 
    backgroundColor: 'white', 
    color: '#d35400', 
    paddingHorizontal: 12, 
    paddingVertical: 6, 
    borderRadius: 6, 
    fontSize: 16, 
    fontWeight: 'bold', 
    width: 95, 
    textAlign: 'center' 
  },
  actionRow: { 
    flexDirection: 'row', 
    padding: 10, 
    backgroundColor: '#e67e22', 
    justifyContent: 'space-between' 
  },
  btnAction: { 
    flex: 1, 
    marginHorizontal: 4, 
    paddingVertical: 10, 
    borderRadius: 6, 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  btnPdf: { backgroundColor: '#2c3e50' },
  btnBackup: { backgroundColor: '#27ae60' },
  btnText: { color: 'white', fontSize: 15, fontWeight: 'bold' },
  categoryTabs: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#dcdde1', paddingVertical: 5 },
  tab: { paddingHorizontal: 16, justifyContent: 'center', alignItems: 'center', marginHorizontal: 4, borderRadius: 20, height: 36 },
  tabAtiva: { backgroundColor: '#f39c12' },
  tabText: { color: '#7f8c8d', fontSize: 15, fontWeight: '600' },
  tabTextAtiva: { color: 'white', fontWeight: 'bold' },
  formContainer: { flex: 1, padding: 14 },
  categoryTitle: { fontSize: 18, fontWeight: 'bold', color: '#2c3e50', marginVertical: 10, textTransform: 'uppercase' },
  inputGroup: { 
    backgroundColor: 'white', 
    borderRadius: 8, 
    padding: 12, 
    marginBottom: 10, 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2
  },
  inputLabel: { fontSize: 16, color: '#333', flex: 1, paddingRight: 10, lineHeight: 22 },
  inputValor: { 
    borderWidth: 1.5, 
    borderColor: '#bdc3c7', 
    borderRadius: 6, 
    width: 75, 
    height: 45, 
    textAlign: 'center', 
    fontSize: 18, 
    fontWeight: 'bold', 
    color: '#2c3e50',
    backgroundColor: '#f9f9f9'
  }
});
