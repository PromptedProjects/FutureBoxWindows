import { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Image,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import {
  getBrowserTabs,
  openBrowserTab,
  closeBrowserTab,
  navigateBrowserTab,
  screenshotBrowserTab,
  openInDesktopBrowser,
} from '../services/api';
import { colors } from '../theme/tokens';
import type { TabInfo } from '../types/models';

export default function BrowserScreen({ onBack }: { onBack?: () => void }) {
  const [tabs, setTabs] = useState<TabInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [screenshotData, setScreenshotData] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState<string | null>(null);

  const fetchTabs = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    const res = await getBrowserTabs();
    if (res.ok) setTabs(res.data.tabs);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchTabs();
    }, [])
  );

  async function handleOpenTab() {
    if (!urlInput.trim()) return;
    const url = urlInput.startsWith('http') ? urlInput : `https://${urlInput}`;
    setLoading(true);
    const res = await openInDesktopBrowser(url);
    setLoading(false);
    if (res.ok) {
      setUrlInput('');
    } else {
      Alert.alert('Error', res.error);
    }
  }

  async function handleCloseTab(id: string) {
    await closeBrowserTab(id);
    fetchTabs();
  }

  async function handleScreenshot(id: string) {
    setLoading(true);
    const res = await screenshotBrowserTab(id);
    setLoading(false);
    if (res.ok) {
      setScreenshotData(res.data.image);
      setSelectedTab(id);
    } else {
      Alert.alert('Error', res.error);
    }
  }

  if (screenshotData && selectedTab) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.screen}>
          <View style={styles.header}>
            <Pressable onPress={() => { setScreenshotData(null); setSelectedTab(null); }} style={styles.backBtn}>
              <Feather name="arrow-left" size={20} color={colors.text} />
            </Pressable>
            <Text style={styles.headerTitle}>Tab Screenshot</Text>
            <View style={{ width: 36 }} />
          </View>
          <Image
            source={{ uri: `data:image/png;base64,${screenshotData}` }}
            style={styles.screenshot}
            resizeMode="contain"
          />
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
          <Text style={styles.headerTitle}>Browser</Text>
          {onBack && <View style={{ width: 36 }} />}
        </View>

        <View style={styles.urlBar}>
          <TextInput
            style={styles.urlInput}
            value={urlInput}
            onChangeText={setUrlInput}
            placeholder="Enter URL..."
            placeholderTextColor={colors.textMuted}
            onSubmitEditing={handleOpenTab}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Pressable onPress={handleOpenTab} style={styles.goBtn}>
            <Feather name="arrow-right" size={18} color={colors.accent} />
          </Pressable>
        </View>

        {loading && !refreshing ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.accent} size="large" />
          </View>
        ) : (
          <FlatList
            data={tabs}
            keyExtractor={(item) => item.id}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => fetchTabs(true)}
                tintColor={colors.accent}
              />
            }
            renderItem={({ item }) => (
              <Pressable
                onPress={() => handleScreenshot(item.id)}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              >
                <Feather name="globe" size={18} color={colors.accent} />
                <View style={styles.rowInfo}>
                  <Text style={styles.rowTitle} numberOfLines={1}>{item.title || item.url}</Text>
                  <Text style={styles.rowUrl} numberOfLines={1}>{item.url}</Text>
                </View>
                <Pressable onPress={() => handleCloseTab(item.id)}>
                  <Feather name="x" size={18} color={colors.textMuted} />
                </Pressable>
              </Pressable>
            )}
            ListEmptyComponent={
              <View style={styles.center}>
                <Feather name="globe" size={32} color={colors.textMuted} />
                <Text style={styles.emptyText}>No browser tabs open</Text>
                <Text style={styles.emptyHint}>Enter a URL above to get started</Text>
              </View>
            }
            contentContainerStyle={tabs.length === 0 ? styles.emptyContainer : undefined}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  screen: { flex: 1, backgroundColor: colors.bg },
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
  urlBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 8,
  },
  urlInput: {
    flex: 1,
    backgroundColor: colors.bgSurface,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: colors.text,
    fontSize: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  goBtn: {
    padding: 8,
    backgroundColor: colors.bgElevated,
    borderRadius: 8,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    padding: 32,
  },
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
  rowInfo: { flex: 1, gap: 2 },
  rowTitle: { color: colors.text, fontSize: 14, fontWeight: '500' },
  rowUrl: { color: colors.textMuted, fontSize: 12 },
  emptyContainer: { flex: 1 },
  emptyText: { color: colors.textMuted, fontSize: 14 },
  emptyHint: { color: colors.textMuted, fontSize: 12 },
  screenshot: { flex: 1, width: '100%' },
});
