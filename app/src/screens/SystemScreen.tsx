import { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import {
  powerShutdown,
  powerRestart,
  powerSleep,
  powerLock,
  powerCancelShutdown,
  getVolume,
  setVolume,
  toggleMute,
  getNetworkInterfaces,
  getPublicIp,
} from '../services/api';
import { colors } from '../theme/tokens';
import type { NetworkInterface } from '../types/models';

export default function SystemScreen({ onBack }: { onBack?: () => void }) {
  const [volumeLevel, setVolumeLevel] = useState<number | null>(null);
  const [interfaces, setInterfaces] = useState<NetworkInterface[]>([]);
  const [publicIp, setPublicIp] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    const [volRes, ifaceRes, ipRes] = await Promise.all([
      getVolume(),
      getNetworkInterfaces(),
      getPublicIp(),
    ]);

    if (volRes.ok) setVolumeLevel(volRes.data.level);
    if (ifaceRes.ok) setInterfaces(ifaceRes.data.interfaces);
    if (ipRes.ok) setPublicIp(ipRes.data.ip);

    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(useCallback(() => { fetchData(); }, []));

  function confirmPowerAction(action: string, fn: () => Promise<unknown>) {
    Alert.alert(
      `Confirm ${action}`,
      `Are you sure you want to ${action.toLowerCase()} the system?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: action,
          style: 'destructive',
          onPress: async () => {
            const res = await fn();
            if (res && typeof res === 'object' && 'ok' in res && !(res as { ok: boolean }).ok) {
              const errObj = res as unknown as { error: string };
              Alert.alert('Error', errObj.error);
            }
          },
        },
      ]
    );
  }

  async function handleVolumeChange(delta: number) {
    const newLevel = Math.max(0, Math.min(100, (volumeLevel ?? 50) + delta));
    const res = await setVolume(newLevel);
    if (res.ok) setVolumeLevel(res.data.level);
  }

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.screen}>
        <View style={styles.header}>
          {onBack && (
            <Pressable onPress={onBack} style={styles.backBtn}>
              <Feather name="arrow-left" size={20} color={colors.text} />
            </Pressable>
          )}
          <Text style={styles.headerTitle}>System</Text>
          {onBack && <View style={{ width: 36 }} />}
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => fetchData(true)} tintColor={colors.accent} />
          }
        >
          {/* Power Controls */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Power</Text>
            <View style={styles.buttonRow}>
              <Pressable style={styles.powerBtn} onPress={() => confirmPowerAction('Lock', () => powerLock())}>
                <Feather name="lock" size={20} color={colors.warning} />
                <Text style={styles.powerBtnText}>Lock</Text>
              </Pressable>
              <Pressable style={styles.powerBtn} onPress={() => confirmPowerAction('Sleep', () => powerSleep())}>
                <Feather name="moon" size={20} color={colors.warning} />
                <Text style={styles.powerBtnText}>Sleep</Text>
              </Pressable>
              <Pressable style={styles.powerBtn} onPress={() => confirmPowerAction('Restart', () => powerRestart(30))}>
                <Feather name="refresh-cw" size={20} color={colors.error} />
                <Text style={styles.powerBtnText}>Restart</Text>
              </Pressable>
              <Pressable style={styles.powerBtn} onPress={() => confirmPowerAction('Shutdown', () => powerShutdown(30))}>
                <Feather name="power" size={20} color={colors.error} />
                <Text style={styles.powerBtnText}>Shutdown</Text>
              </Pressable>
            </View>
            <Pressable style={styles.cancelBtn} onPress={() => powerCancelShutdown()}>
              <Text style={styles.cancelText}>Cancel Pending Shutdown</Text>
            </Pressable>
          </View>

          {/* Audio Controls */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Audio</Text>
            <View style={styles.volumeRow}>
              <Pressable onPress={() => handleVolumeChange(-10)} style={styles.volBtn}>
                <Feather name="volume-1" size={20} color={colors.text} />
              </Pressable>
              <View style={styles.volumeBar}>
                <View style={[styles.volumeFill, { width: `${volumeLevel ?? 0}%` }]} />
              </View>
              <Pressable onPress={() => handleVolumeChange(10)} style={styles.volBtn}>
                <Feather name="volume-2" size={20} color={colors.text} />
              </Pressable>
              <Text style={styles.volumeText}>{volumeLevel ?? '?'}%</Text>
            </View>
            <Pressable style={styles.muteBtn} onPress={() => toggleMute()}>
              <Feather name="volume-x" size={16} color={colors.textSecondary} />
              <Text style={styles.muteText}>Toggle Mute</Text>
            </Pressable>
          </View>

          {/* Network Info */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Network</Text>
            {publicIp ? (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Public IP</Text>
                <Text style={styles.infoValue}>{publicIp}</Text>
              </View>
            ) : null}
            {interfaces.filter(i => i.ip4).map((iface) => (
              <View key={iface.iface} style={styles.infoRow}>
                <Text style={styles.infoLabel}>{iface.iface}</Text>
                <Text style={styles.infoValue}>{iface.ip4} ({iface.operstate})</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: { width: 36, alignItems: 'flex-start' },
  headerTitle: {
    flex: 1,
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
    padding: 16,
    gap: 12,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
  },
  powerBtn: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
    backgroundColor: colors.bgElevated,
    borderRadius: 8,
  },
  powerBtnText: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  cancelBtn: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  cancelText: {
    color: colors.accent,
    fontSize: 13,
  },
  volumeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  volBtn: { padding: 4 },
  volumeBar: {
    flex: 1,
    height: 6,
    backgroundColor: colors.bgElevated,
    borderRadius: 3,
    overflow: 'hidden',
  },
  volumeFill: {
    height: '100%',
    backgroundColor: colors.accent,
    borderRadius: 3,
  },
  volumeText: {
    color: colors.textSecondary,
    fontSize: 13,
    width: 36,
    textAlign: 'right',
  },
  muteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'center',
  },
  muteText: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  infoLabel: { color: colors.textSecondary, fontSize: 13 },
  infoValue: { color: colors.text, fontSize: 13 },
});
