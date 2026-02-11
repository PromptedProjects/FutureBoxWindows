import { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Alert, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import Btn from '../components/Btn';
import StatusCard from '../components/StatusCard';
import ConfigRow from '../components/ConfigRow';
import TrustRulesScreen from './TrustRulesScreen';
import ModelsScreen from './ModelsScreen';
import BrowserScreen from './BrowserScreen';
import SystemScreen from './SystemScreen';
import SchedulerScreen from './SchedulerScreen';
import SkillsScreen from './SkillsScreen';
import { useStatus } from '../hooks/useStatus';
import { useConfig } from '../hooks/useConfig';
import { useBiometric } from '../hooks/useBiometric';
import { useAuthStore } from '../stores/auth.store';
import { useAppSettingsStore } from '../stores/appSettings.store';
import { wsManager } from '../services/ws';
import { clearAll } from '../services/storage';
import { colors } from '../theme/tokens';

type SubScreen = 'trust-rules' | 'models' | 'browser' | 'system' | 'scheduler' | 'skills' | null;

export default function SettingsScreen() {
  const [subScreen, setSubScreen] = useState<SubScreen>(null);
  const { status } = useStatus();
  const { config, fetchConfig, updateConfig } = useConfig();
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const { biometricEnabled, toggleBiometric } = useBiometric();
  const sttLanguage = useAppSettingsStore((s) => s.sttLanguage);
  const setSttLanguage = useAppSettingsStore((s) => s.setSttLanguage);
  const loadSettings = useAppSettingsStore((s) => s.loadSettings);

  useEffect(() => {
    fetchConfig();
    loadSettings();
  }, [fetchConfig, loadSettings]);

  const LANGUAGES = [
    { code: '', label: 'Auto-detect' },
    { code: 'en', label: 'English' },
    { code: 'es', label: 'Spanish' },
    { code: 'fr', label: 'French' },
    { code: 'de', label: 'German' },
    { code: 'it', label: 'Italian' },
    { code: 'pt', label: 'Portuguese' },
    { code: 'ja', label: 'Japanese' },
    { code: 'ko', label: 'Korean' },
    { code: 'zh', label: 'Chinese' },
    { code: 'ar', label: 'Arabic' },
    { code: 'hi', label: 'Hindi' },
    { code: 'ru', label: 'Russian' },
  ];

  function handleLanguagePicker() {
    const buttons = LANGUAGES.map((lang) => ({
      text: lang.code === sttLanguage
        ? `${lang.label} (current)`
        : lang.label,
      onPress: () => setSttLanguage(lang.code),
    }));
    buttons.push({ text: 'Cancel', onPress: () => {} });
    Alert.alert('Voice Language', 'Choose the language for speech recognition', buttons);
  }

  function handleUnpair() {
    Alert.alert(
      'Unpair Device',
      'This will disconnect from FutureBox and clear your session. You will need to pair again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unpair',
          style: 'destructive',
          onPress: async () => {
            wsManager.disconnect();
            await clearAll();
            clearAuth();
          },
        },
      ],
    );
  }

  if (subScreen === 'trust-rules') {
    return <TrustRulesScreen onBack={() => setSubScreen(null)} />;
  }
  if (subScreen === 'models') {
    return <ModelsScreen onBack={() => setSubScreen(null)} />;
  }
  if (subScreen === 'browser') {
    return <BrowserScreen onBack={() => setSubScreen(null)} />;
  }
  if (subScreen === 'system') {
    return <SystemScreen onBack={() => setSubScreen(null)} />;
  }
  if (subScreen === 'scheduler') {
    return <SchedulerScreen onBack={() => setSubScreen(null)} />;
  }
  if (subScreen === 'skills') {
    return <SkillsScreen onBack={() => setSubScreen(null)} />;
  }

  const configKeys = Object.keys(config).sort();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.screen}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Settings</Text>
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          {/* Status */}
          {status && <StatusCard status={status} />}

          {/* Navigation rows */}
          <View style={styles.section}>
            <Pressable onPress={() => setSubScreen('trust-rules')}>
              <View style={styles.navRow}>
                <View style={styles.navRowLeft}>
                  <Feather name="shield" size={18} color={colors.accent} />
                  <Text style={styles.navRowText}>Trust Rules</Text>
                </View>
                <Feather name="chevron-right" size={18} color={colors.textMuted} />
              </View>
            </Pressable>

            <View style={styles.separator} />

            <Pressable onPress={() => setSubScreen('models')}>
              <View style={styles.navRow}>
                <View style={styles.navRowLeft}>
                  <Feather name="cpu" size={18} color={colors.accent} />
                  <Text style={styles.navRowText}>Models</Text>
                </View>
                <Feather name="chevron-right" size={18} color={colors.textMuted} />
              </View>
            </Pressable>

            <View style={styles.separator} />

            <Pressable onPress={() => setSubScreen('browser')}>
              <View style={styles.navRow}>
                <View style={styles.navRowLeft}>
                  <Feather name="globe" size={18} color={colors.accent} />
                  <Text style={styles.navRowText}>Browser</Text>
                </View>
                <Feather name="chevron-right" size={18} color={colors.textMuted} />
              </View>
            </Pressable>

            <View style={styles.separator} />

            <Pressable onPress={() => setSubScreen('system')}>
              <View style={styles.navRow}>
                <View style={styles.navRowLeft}>
                  <Feather name="monitor" size={18} color={colors.accent} />
                  <Text style={styles.navRowText}>System Controls</Text>
                </View>
                <Feather name="chevron-right" size={18} color={colors.textMuted} />
              </View>
            </Pressable>

            <View style={styles.separator} />

            <Pressable onPress={() => setSubScreen('scheduler')}>
              <View style={styles.navRow}>
                <View style={styles.navRowLeft}>
                  <Feather name="clock" size={18} color={colors.accent} />
                  <Text style={styles.navRowText}>Automation</Text>
                </View>
                <Feather name="chevron-right" size={18} color={colors.textMuted} />
              </View>
            </Pressable>

            <View style={styles.separator} />

            <Pressable onPress={() => setSubScreen('skills')}>
              <View style={styles.navRow}>
                <View style={styles.navRowLeft}>
                  <Feather name="zap" size={18} color={colors.accent} />
                  <Text style={styles.navRowText}>Skills</Text>
                </View>
                <Feather name="chevron-right" size={18} color={colors.textMuted} />
              </View>
            </Pressable>
          </View>

          {/* Security */}
          <View style={styles.section}>
            <View style={styles.navRow}>
              <View style={styles.navRowLeft}>
                <Feather name="lock" size={18} color={colors.accent} />
                <Text style={styles.navRowText}>Biometric Lock</Text>
              </View>
              <Switch
                value={biometricEnabled}
                onValueChange={() => { toggleBiometric(); }}
                trackColor={{ false: colors.bgHover, true: colors.accent }}
                thumbColor="white"
              />
            </View>
          </View>

          {/* Voice */}
          <View style={styles.section}>
            <Pressable onPress={handleLanguagePicker}>
              <View style={styles.navRow}>
                <View style={styles.navRowLeft}>
                  <Feather name="globe" size={18} color={colors.accent} />
                  <Text style={styles.navRowText}>Voice Language</Text>
                </View>
                <View style={styles.navRowRight}>
                  <Text style={styles.navRowValue}>
                    {LANGUAGES.find((l) => l.code === sttLanguage)?.label ?? 'Auto-detect'}
                  </Text>
                  <Feather name="chevron-right" size={18} color={colors.textMuted} />
                </View>
              </View>
            </Pressable>
          </View>

          {/* Config */}
          {configKeys.length > 0 && (
            <View style={styles.section}>
              <View style={styles.configHeader}>
                <Text style={styles.configTitle}>Configuration</Text>
              </View>
              {configKeys.map((key) => (
                <ConfigRow
                  key={key}
                  configKey={key}
                  value={config[key]}
                  onSave={updateConfig}
                />
              ))}
            </View>
          )}

          {/* Unpair */}
          <Btn
            backgroundColor={colors.bgSurface}
            borderColor={colors.error}
            borderWidth={1}
            color={colors.error}
            icon={<Feather name="log-out" size={18} color={colors.error} />}
            onPress={handleUnpair}
          >
            Unpair Device
          </Btn>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
  },
  scroll: { padding: 16, gap: 16, paddingBottom: 40 },
  section: {
    backgroundColor: colors.bgSurface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  navRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  navRowLeft: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  navRowText: {
    color: colors.text,
    fontSize: 15,
  },
  navRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  navRowValue: {
    color: colors.textMuted,
    fontSize: 14,
  },
  separator: {
    height: 1,
    backgroundColor: colors.border,
  },
  configHeader: {
    padding: 16,
    paddingBottom: 8,
  },
  configTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
});
