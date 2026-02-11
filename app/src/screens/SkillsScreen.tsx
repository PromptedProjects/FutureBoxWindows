import { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { getSkills } from '../services/api';
import { colors } from '../theme/tokens';
import type { Skill, SkillAction } from '../types/models';

export default function SkillsScreen({ onBack }: { onBack?: () => void }) {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchSkills = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    const res = await getSkills();
    if (res.ok) setSkills(res.data.skills);

    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(useCallback(() => { fetchSkills(); }, []));

  const tierColor = (tier: string) =>
    tier === 'red' ? colors.tierRed : tier === 'yellow' ? colors.tierYellow : colors.tierGreen;

  function renderAction(action: SkillAction) {
    return (
      <View key={action.name} style={styles.actionRow}>
        <View style={[styles.tierBadge, { backgroundColor: tierColor(action.tier) }]}>
          <Text style={styles.tierText}>{action.tier}</Text>
        </View>
        <View style={styles.actionInfo}>
          <Text style={styles.actionName}>{action.name}</Text>
          <Text style={styles.actionDesc}>{action.description}</Text>
        </View>
      </View>
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
          <Text style={styles.headerTitle}>Skills</Text>
          {onBack && <View style={{ width: 36 }} />}
        </View>

        {loading && !refreshing ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.accent} size="large" />
          </View>
        ) : (
          <FlatList
            data={skills}
            keyExtractor={(item) => item.id}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={() => fetchSkills(true)} tintColor={colors.accent} />
            }
            renderItem={({ item }) => (
              <View>
                <Pressable
                  onPress={() => setExpandedId(expandedId === item.id ? null : item.id)}
                  style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                >
                  <View style={[styles.statusDot, { backgroundColor: item.enabled ? colors.success : colors.textMuted }]} />
                  <View style={styles.rowInfo}>
                    <Text style={styles.rowName}>{item.name}</Text>
                    <Text style={styles.rowDesc}>{item.description}</Text>
                    <Text style={styles.rowMeta}>{item.actions.length} actions</Text>
                  </View>
                  <Feather
                    name={expandedId === item.id ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color={colors.textMuted}
                  />
                </Pressable>
                {expandedId === item.id && (
                  <View style={styles.actionsContainer}>
                    {item.actions.map(renderAction)}
                  </View>
                )}
              </View>
            )}
            ListEmptyComponent={
              <View style={styles.center}>
                <Feather name="zap" size={32} color={colors.textMuted} />
                <Text style={styles.emptyText}>No skills registered</Text>
              </View>
            }
            contentContainerStyle={skills.length === 0 ? styles.emptyContainer : undefined}
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowPressed: { backgroundColor: colors.bgHover },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  rowInfo: { flex: 1, gap: 2 },
  rowName: { color: colors.text, fontSize: 15, fontWeight: '600' },
  rowDesc: { color: colors.textSecondary, fontSize: 13 },
  rowMeta: { color: colors.textMuted, fontSize: 12 },
  actionsContainer: {
    backgroundColor: colors.bgElevated,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
  },
  tierBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    minWidth: 42,
    alignItems: 'center',
  },
  tierText: {
    color: colors.bg,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  actionInfo: { flex: 1, gap: 1 },
  actionName: { color: colors.text, fontSize: 13, fontWeight: '500' },
  actionDesc: { color: colors.textMuted, fontSize: 11 },
  emptyContainer: { flex: 1 },
  emptyText: { color: colors.textMuted, fontSize: 14 },
});
