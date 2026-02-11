import { useState, useRef, useCallback, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, Pressable, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import MessageBubble from '../components/MessageBubble';
import StreamingText from '../components/StreamingText';
import TypingIndicator from '../components/TypingIndicator';
import ToolStatusBar from '../components/ToolStatusBar';
import ChatInput from '../components/ChatInput';
import CallBar from '../components/CallBar';
import ConversationListScreen from './ConversationListScreen';
import { useChat } from '../hooks/useChat';
import { useConversations } from '../hooks/useConversations';
import { useConnection } from '../hooks/useConnection';
import { colors } from '../theme/tokens';
import { useAppSettingsStore } from '../stores/appSettings.store';
import type { Message } from '../types/models';

export default function ChatScreen() {
  const {
    messages,
    streamingContent,
    isStreaming,
    toolActivities,
    sendMessage,
    cancelStream,
    loadConversation,
  } = useChat();
  const { isConnected } = useConnection();
  const [showConversations, setShowConversations] = useState(false);
  const [callActive, setCallActive] = useState(false);
  const [videoOn, setVideoOn] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const listRef = useRef<FlatList<Message>>(null);
  const cameraRef = useRef<CameraView>(null);
  const { newConversation } = useConversations();
  const [camPermission, requestCamPermission] = useCameraPermissions();

  // Build display data: messages + streaming placeholder
  const displayData = [...messages].reverse();

  // Auto-scroll to bottom during a call when new messages arrive
  useEffect(() => {
    if (callActive && listRef.current) {
      listRef.current.scrollToOffset({ offset: 0, animated: true });
    }
  }, [messages.length, callActive]);

  // Turn off video when call ends
  useEffect(() => {
    if (!callActive) {
      setVideoOn(false);
      setCameraReady(false);
    }
  }, [callActive]);

  const renderItem = useCallback(
    ({ item }: { item: Message }) => <MessageBubble message={item} />,
    [],
  );

  function handleImage(base64: string) {
    sendMessage('What do you see in this image?', [base64]);
  }

  async function handleTranscribe(uri: string): Promise<string | null> {
    try {
      const FileSystem = await import('expo-file-system/legacy');
      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
      if (!base64) {
        Alert.alert('Voice error', 'Recording file was empty.');
        return null;
      }
      const { transcribeAudio } = await import('../services/api');
      const lang = useAppSettingsStore.getState().sttLanguage || undefined;
      const res = await transcribeAudio(base64, lang);
      if (res.ok && res.data?.text) {
        return res.data.text;
      } else {
        const errMsg = !res.ok && 'error' in res ? (res as any).error : 'Unknown error';
        Alert.alert('Transcription failed', String(errMsg));
        return null;
      }
    } catch (err: any) {
      Alert.alert('Voice error', err?.message ?? 'Failed to process audio.');
      return null;
    }
  }

  async function handleToggleVideo() {
    if (videoOn) {
      setVideoOn(false);
      setCameraReady(false);
      return;
    }
    // Request permission if needed
    if (!camPermission?.granted) {
      const result = await requestCamPermission();
      if (!result.granted) return;
    }
    setVideoOn(true);
  }

  if (showConversations) {
    return (
      <ConversationListScreen
        onSelect={(id) => {
          loadConversation(id);
          setShowConversations(false);
        }}
        onNew={() => {
          newConversation();
          setShowConversations(false);
        }}
        onClose={() => setShowConversations(false)}
      />
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <View style={styles.screen}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Pressable onPress={() => setShowConversations(true)}>
                <Feather name="list" size={24} color={colors.text} />
              </Pressable>
              <Pressable
                onPress={() => setCallActive(!callActive)}
                style={[styles.phoneBtn, callActive && styles.phoneBtnActive]}
              >
                <Feather
                  name={callActive ? 'phone-off' : 'phone'}
                  size={20}
                  color={callActive ? colors.error : colors.accent}
                />
              </Pressable>
            </View>
            <Text style={styles.headerTitle}>Future Buddy</Text>
            <View style={styles.statusContainer}>
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: isConnected ? colors.success : colors.error },
                ]}
              />
            </View>
          </View>

          {/* Call bar — shown below header when call is active */}
          {callActive && (
            <CallBar
              onEnd={() => setCallActive(false)}
              videoOn={videoOn}
              onToggleVideo={handleToggleVideo}
              cameraRef={cameraRef}
            />
          )}

          {/* Camera preview — shown when video is on during call */}
          {callActive && videoOn && (
            <View style={styles.cameraContainer}>
              <CameraView
                ref={cameraRef}
                style={styles.camera}
                facing="back"
                onCameraReady={() => setCameraReady(true)}
              />
              {!cameraReady && (
                <View style={styles.cameraLoading}>
                  <Text style={styles.cameraLoadingText}>Starting camera...</Text>
                </View>
              )}
            </View>
          )}

          {/* Messages */}
          <FlatList
            ref={listRef}
            data={displayData}
            renderItem={renderItem}
            keyExtractor={(item: Message) => item.id}
            inverted
            style={styles.messagesList}
            contentContainerStyle={styles.messagesContent}
            keyboardShouldPersistTaps="handled"
            maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
            ListHeaderComponent={
              <>
                {toolActivities.length > 0 && (
                  <ToolStatusBar activities={toolActivities} />
                )}
                {streamingContent ? (
                  <StreamingText content={streamingContent} />
                ) : isStreaming && toolActivities.length === 0 ? (
                  <TypingIndicator />
                ) : null}
              </>
            }
          />

          {/* Input */}
          <ChatInput
            onSend={sendMessage}
            onCancel={cancelStream}
            isStreaming={isStreaming}
            onImage={handleImage}
            onTranscribe={handleTranscribe}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  phoneBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.accent + '1a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  phoneBtnActive: {
    backgroundColor: colors.error + '1a',
  },
  headerTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '600',
  },
  statusContainer: {
    width: 24,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  cameraContainer: {
    height: 180,
    backgroundColor: '#000',
    overflow: 'hidden',
  },
  camera: {
    flex: 1,
  },
  cameraLoading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000',
  },
  cameraLoadingText: {
    color: colors.textMuted,
    fontSize: 13,
  },
  messagesList: {
    flex: 1,
  },
  messagesContent: {
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
});
