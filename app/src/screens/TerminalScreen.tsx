import { useRef, useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { XTermView, type XTermHandle } from '../components/XTermView';
import { wsManager } from '../services/ws';
import { uid } from '../utils/uid';
import { colors } from '../theme/tokens';
import type { ShellOutputPayload, ShellExitPayload } from '../types/ws';

interface TermTab {
  id: string;
  title: string;
  spawned: boolean;
}

export default function TerminalScreen() {
  const [tabs, setTabs] = useState<TermTab[]>(() => [
    { id: uid(8), title: 'Shell 1', spawned: false },
  ]);
  const [activeTabId, setActiveTabId] = useState(tabs[0].id);
  const tabCounter = useRef(1);
  const xtermRefs = useRef<Map<string, XTermHandle>>(new Map());

  const activeTab = tabs.find((t) => t.id === activeTabId) ?? tabs[0];

  // Subscribe to WS shell events and pipe to xterm
  useEffect(() => {
    const unsubs = [
      wsManager.on<ShellOutputPayload>('shell.output', (payload) => {
        const xterm = xtermRefs.current.get(payload.tab_id);
        xterm?.write(payload.data);
      }),
      wsManager.on<ShellExitPayload>('shell.exit', (payload) => {
        const xterm = xtermRefs.current.get(payload.tab_id);
        xterm?.write(`\r\n[shell exited: ${payload.code ?? payload.signal ?? '?'}]\r\n`);
        setTabs((prev) =>
          prev.map((t) =>
            t.id === payload.tab_id ? { ...t, spawned: false } : t,
          ),
        );
      }),
    ];
    return () => unsubs.forEach((u) => u());
  }, []);

  // Spawn PTY when a tab becomes active and hasn't spawned yet
  useEffect(() => {
    if (!activeTab.spawned) {
      wsManager.shellExec(activeTab.id, '');
      setTabs((prev) =>
        prev.map((t) =>
          t.id === activeTab.id ? { ...t, spawned: true } : t,
        ),
      );
    }
  }, [activeTab.id, activeTab.spawned]);

  const handleData = useCallback(
    (data: string) => {
      wsManager.shellInput(activeTabId, data);
    },
    [activeTabId],
  );

  const handleResize = useCallback(
    (cols: number, rows: number) => {
      wsManager.shellResize(activeTabId, cols, rows);
    },
    [activeTabId],
  );

  const setXtermRef = useCallback(
    (handle: XTermHandle | null) => {
      if (handle) {
        xtermRefs.current.set(activeTabId, handle);
      }
    },
    [activeTabId],
  );

  const addTab = useCallback(() => {
    tabCounter.current++;
    const newTab: TermTab = {
      id: uid(8),
      title: `Shell ${tabCounter.current}`,
      spawned: false,
    };
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newTab.id);
  }, []);

  const closeTab = useCallback(
    (tabId: string) => {
      wsManager.shellKill(tabId);
      xtermRefs.current.delete(tabId);

      setTabs((prev) => {
        const filtered = prev.filter((t) => t.id !== tabId);
        if (filtered.length === 0) {
          tabCounter.current++;
          return [{ id: uid(8), title: `Shell ${tabCounter.current}`, spawned: false }];
        }
        return filtered;
      });

      setActiveTabId((current) => {
        if (current === tabId) {
          const idx = tabs.findIndex((t) => t.id === tabId);
          const remaining = tabs.filter((t) => t.id !== tabId);
          if (remaining.length === 0) return current;
          return remaining[Math.min(idx, remaining.length - 1)].id;
        }
        return current;
      });
    },
    [tabs],
  );

  const killActive = useCallback(() => {
    wsManager.shellKill(activeTabId);
    setTabs((prev) =>
      prev.map((t) =>
        t.id === activeTabId ? { ...t, spawned: false } : t,
      ),
    );
  }, [activeTabId]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Tab bar */}
      <View style={styles.tabBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabScroll}
        >
          {tabs.map((tab) => (
            <Pressable
              key={tab.id}
              onPress={() => setActiveTabId(tab.id)}
              style={[styles.tab, tab.id === activeTabId && styles.tabActive]}
            >
              {tab.spawned && <View style={styles.runningDot} />}
              <Text
                style={[
                  styles.tabText,
                  tab.id === activeTabId && styles.tabTextActive,
                ]}
                numberOfLines={1}
              >
                {tab.title}
              </Text>
              {tabs.length > 1 && (
                <Pressable
                  onPress={(e) => {
                    e.stopPropagation();
                    closeTab(tab.id);
                  }}
                  hitSlop={8}
                  style={styles.tabClose}
                >
                  <Feather name="x" size={12} color={colors.textMuted} />
                </Pressable>
              )}
            </Pressable>
          ))}
        </ScrollView>

        <Pressable onPress={addTab} style={styles.addTabBtn}>
          <Feather name="plus" size={18} color={colors.textMuted} />
        </Pressable>

        <View style={styles.headerActions}>
          {activeTab.spawned && (
            <Pressable onPress={killActive} style={styles.headerBtn}>
              <Feather name="square" size={14} color={colors.error} />
            </Pressable>
          )}
        </View>
      </View>

      {/* xterm.js terminal — key forces re-mount per tab */}
      <XTermView
        key={activeTabId}
        ref={setXtermRef}
        onData={handleData}
        onResize={handleResize}
        fontSize={13}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0c0c0c' },
  tabBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingRight: 4,
  },
  tabScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 4,
    paddingVertical: 6,
    gap: 2,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 6,
  },
  tabActive: {
    backgroundColor: '#1e1e1e',
  },
  tabText: {
    color: colors.textMuted,
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  tabTextActive: {
    color: colors.text,
  },
  tabClose: {
    padding: 2,
  },
  runningDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.success,
  },
  addTabBtn: {
    padding: 8,
  },
  headerActions: {
    flexDirection: 'row',
    marginLeft: 'auto',
    gap: 8,
    paddingRight: 8,
  },
  headerBtn: {
    padding: 4,
  },
});
