import { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import {
  getScheduledTasks,
  deleteScheduledTask,
  runScheduledTaskNow,
  enableScheduledTask,
  disableScheduledTask,
  getWebhooks,
  deleteWebhook,
} from '../services/api';
import { colors } from '../theme/tokens';
import type { ScheduledTask, Webhook } from '../types/models';

type SubTab = 'tasks' | 'webhooks';

export default function SchedulerScreen({ onBack }: { onBack?: () => void }) {
  const [subTab, setSubTab] = useState<SubTab>('tasks');
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    const [tasksRes, webhooksRes] = await Promise.all([
      getScheduledTasks(),
      getWebhooks(),
    ]);

    if (tasksRes.ok) setTasks(tasksRes.data.tasks);
    if (webhooksRes.ok) setWebhooks(webhooksRes.data.webhooks);

    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(useCallback(() => { fetchData(); }, []));

  async function handleToggleTask(task: ScheduledTask) {
    if (task.enabled) {
      await disableScheduledTask(task.id);
    } else {
      await enableScheduledTask(task.id);
    }
    fetchData();
  }

  async function handleRunNow(id: string) {
    const res = await runScheduledTaskNow(id);
    if (!res.ok) Alert.alert('Error', res.error);
    else Alert.alert('Success', 'Task executed');
    fetchData();
  }

  async function handleDeleteTask(id: string) {
    Alert.alert('Delete Task', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteScheduledTask(id);
          fetchData();
        },
      },
    ]);
  }

  async function handleDeleteWebhook(id: string) {
    Alert.alert('Delete Webhook', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteWebhook(id);
          fetchData();
        },
      },
    ]);
  }

  const tierColor = (tier: string) =>
    tier === 'red' ? colors.tierRed : tier === 'yellow' ? colors.tierYellow : colors.tierGreen;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.screen}>
        <View style={styles.header}>
          {onBack && (
            <Pressable onPress={onBack} style={styles.backBtn}>
              <Feather name="arrow-left" size={20} color={colors.text} />
            </Pressable>
          )}
          <Text style={styles.headerTitle}>Automation</Text>
          {onBack && <View style={{ width: 36 }} />}
        </View>

        <View style={styles.tabs}>
          <Pressable
            style={[styles.tab, subTab === 'tasks' && styles.tabActive]}
            onPress={() => setSubTab('tasks')}
          >
            <Text style={[styles.tabText, subTab === 'tasks' && styles.tabTextActive]}>Tasks</Text>
          </Pressable>
          <Pressable
            style={[styles.tab, subTab === 'webhooks' && styles.tabActive]}
            onPress={() => setSubTab('webhooks')}
          >
            <Text style={[styles.tabText, subTab === 'webhooks' && styles.tabTextActive]}>Webhooks</Text>
          </Pressable>
        </View>

        {loading && !refreshing ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.accent} size="large" />
          </View>
        ) : subTab === 'tasks' ? (
          <FlatList
            data={tasks}
            keyExtractor={(item) => item.id}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={() => fetchData(true)} tintColor={colors.accent} />
            }
            renderItem={({ item }) => (
              <View style={styles.row}>
                <View style={styles.rowInfo}>
                  <View style={styles.rowHeader}>
                    <View style={[styles.tierDot, { backgroundColor: tierColor(item.tier) }]} />
                    <Text style={styles.rowName}>{item.name}</Text>
                  </View>
                  <Text style={styles.rowMeta}>{item.cron} - {item.action_type}</Text>
                  {item.last_run_at && (
                    <Text style={styles.rowMeta}>Last: {new Date(item.last_run_at).toLocaleString()}</Text>
                  )}
                  {item.next_run_at && (
                    <Text style={styles.rowMeta}>Next: {new Date(item.next_run_at).toLocaleString()}</Text>
                  )}
                </View>
                <View style={styles.rowActions}>
                  <Switch
                    value={!!item.enabled}
                    onValueChange={() => handleToggleTask(item)}
                    trackColor={{ false: colors.bgHover, true: colors.accent }}
                    thumbColor="white"
                  />
                  <Pressable onPress={() => handleRunNow(item.id)} style={styles.actionBtn}>
                    <Feather name="play" size={16} color={colors.accent} />
                  </Pressable>
                  <Pressable onPress={() => handleDeleteTask(item.id)} style={styles.actionBtn}>
                    <Feather name="trash-2" size={16} color={colors.error} />
                  </Pressable>
                </View>
              </View>
            )}
            ListEmptyComponent={
              <View style={styles.center}>
                <Feather name="clock" size={32} color={colors.textMuted} />
                <Text style={styles.emptyText}>No scheduled tasks</Text>
              </View>
            }
            contentContainerStyle={tasks.length === 0 ? styles.emptyContainer : undefined}
          />
        ) : (
          <FlatList
            data={webhooks}
            keyExtractor={(item) => item.id}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={() => fetchData(true)} tintColor={colors.accent} />
            }
            renderItem={({ item }) => (
              <View style={styles.row}>
                <View style={styles.rowInfo}>
                  <View style={styles.rowHeader}>
                    <View style={[styles.tierDot, { backgroundColor: tierColor(item.tier) }]} />
                    <Text style={styles.rowName}>{item.name}</Text>
                  </View>
                  <Text style={styles.rowMeta}>/{item.slug} - {item.action_type}</Text>
                  {item.last_triggered_at && (
                    <Text style={styles.rowMeta}>Last: {new Date(item.last_triggered_at).toLocaleString()}</Text>
                  )}
                </View>
                <Pressable onPress={() => handleDeleteWebhook(item.id)} style={styles.actionBtn}>
                  <Feather name="trash-2" size={16} color={colors.error} />
                </Pressable>
              </View>
            )}
            ListEmptyComponent={
              <View style={styles.center}>
                <Feather name="link" size={32} color={colors.textMuted} />
                <Text style={styles.emptyText}>No webhooks configured</Text>
              </View>
            }
            contentContainerStyle={webhooks.length === 0 ? styles.emptyContainer : undefined}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 32 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: { width: 36, alignItems: 'flex-start' },
  headerTitle: { flex: 1, color: colors.text, fontSize: 17, fontWeight: '600', textAlign: 'center' },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: colors.accent,
  },
  tabText: { color: colors.textMuted, fontSize: 14 },
  tabTextActive: { color: colors.accent, fontWeight: '600' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowInfo: { flex: 1, gap: 4 },
  rowHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tierDot: { width: 8, height: 8, borderRadius: 4 },
  rowName: { color: colors.text, fontSize: 15, fontWeight: '500' },
  rowMeta: { color: colors.textMuted, fontSize: 12 },
  rowActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  actionBtn: { padding: 6 },
  emptyContainer: { flex: 1 },
  emptyText: { color: colors.textMuted, fontSize: 14 },
});
