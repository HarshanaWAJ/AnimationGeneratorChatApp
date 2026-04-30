import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  Image,
  ActivityIndicator,
  Alert,
  Platform,
  Animated,
  Dimensions,
  StatusBar,
  KeyboardAvoidingView,
} from 'react-native';
import { GiftedChat, Bubble, Send, InputToolbar, Composer } from 'react-native-gifted-chat';
import { useAudioRecorder, AudioModule, RecordingPresets } from 'expo-audio';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import io from 'socket.io-client';
import { sendMessage, getMessages } from '../services/chat';
import { getProfile } from '../services/auth';
import config from '../utils/config';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IS_WEB = Platform.OS === 'web';

// ─── COLORS ─────────────────────────
const COLORS = {
  bg: '#070910',
  surface: '#0d1117',
  glass: 'rgba(255,255,255,0.04)',
  glassStroke: 'rgba(255,255,255,0.07)',
  cyan: '#00e5ff',
  cyanDim: 'rgba(0,229,255,0.15)',
  magenta: '#f72585',
  textPrimary: '#e8f4f8',
  textMuted: '#5a7080',
  bubbleRight: '#0a2233',
  bubbleLeft: 'rgba(255,255,255,0.05)',
  inputBg: '#0c1520',
};

// ─── Pulse Animation ─────────────────
function PulseRing({ active }) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (active) {
      Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(scale, { toValue: 1.9, duration: 800, useNativeDriver: true }),
            Animated.timing(opacity, { toValue: 0, duration: 800, useNativeDriver: true }),
          ]),
          Animated.parallel([
            Animated.timing(scale, { toValue: 1, duration: 0, useNativeDriver: true }),
            Animated.timing(opacity, { toValue: 0.6, duration: 0, useNativeDriver: true }),
          ]),
        ])
      ).start();
    }
  }, [active]);

  return (
    <Animated.View
      style={{
        position: 'absolute',
        width: 60,
        height: 60,
        borderRadius: 30,
        borderWidth: 2,
        borderColor: COLORS.magenta,
        opacity,
        transform: [{ scale }],
      }}
    />
  );
}

// ─── MAIN COMPONENT ─────────────────
export default function ChatRoom({ route }) {
  const { recipientId, recipientName } = route.params || {};

  const [messages, setMessages] = useState([]);
  const [user, setUser] = useState(null);
  const [socket, setSocket] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const micScale = useRef(new Animated.Value(1)).current;
  const insets = useSafeAreaInsets?.() ?? { top: 0, bottom: 0 };

  // ── INIT ─────────────────────────
  useEffect(() => {
    const init = async () => {
      const profile = await getProfile();
      setUser(profile);
      await loadMessages();
      setIsLoading(false);
    };
    init();
  }, []);

  // ── SOCKET FIX (WEB SAFE) ─────────
  useEffect(() => {
    let newSocket;

    const initSocket = () => {
      newSocket = io(config.SOCKET_URL, {
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
      });

      setSocket(newSocket);

      newSocket.on('connect', () => {
        newSocket.emit('join_room', recipientId);
      });

      newSocket.on('receive_message', (data) => {
        setMessages(prev =>
          GiftedChat.append(prev, formatMessage(data))
        );
      });
    };

    initSocket();

    return () => {
      if (newSocket) {
        newSocket.removeAllListeners();
        newSocket.disconnect();
      }
    };
  }, [recipientId]);

  // ── WEB VISIBILITY FIX ────────────
  useEffect(() => {
    if (!IS_WEB || !socket) return;

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        socket.connect();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [socket]);

  const loadMessages = async () => {
    const data = await getMessages(recipientId);
    setMessages(data.map(formatMessage).reverse());
  };

  const formatMessage = msg => ({
    _id: msg._id,
    text: msg.text,
    createdAt: new Date(msg.createdAt),
    user: { _id: msg.sender },
    image: msg.gifUrl,
    audio: msg.audioUrl,
  });

  const onSend = useCallback(async (msgs = []) => {
    const msg = msgs[0];
    const saved = await sendMessage({
      receiverId: recipientId,
      type: 'text',
      text: msg.text,
    });

    setMessages(prev => GiftedChat.append(prev, formatMessage(saved)));
  }, [recipientId]);

  // ── MIC ──────────────────────────
  const animateMic = (active) => {
    Animated.spring(micScale, {
      toValue: active ? 1.2 : 1,
      useNativeDriver: true,
    }).start();
  };

  const startRecording = async () => {
    await audioRecorder.prepare();
    await audioRecorder.record();
    animateMic(true);
  };

  const stopRecording = async () => {
    if (!audioRecorder.isRecording) return;
    animateMic(false);
    await audioRecorder.stop();
  };

  // ── UI ───────────────────────────
  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: COLORS.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={{ flex: 1, minHeight: 0 }}>
        <StatusBar barStyle="light-content" />

        {isLoading ? (
          <ActivityIndicator color={COLORS.cyan} />
        ) : (
          <GiftedChat
            messages={messages}
            onSend={msgs => onSend(msgs)}
            user={{ _id: user?._id || 'temp' }}

            inverted={!IS_WEB}
            isKeyboardInternallyHandled={!IS_WEB}

            listViewProps={{
              keyboardShouldPersistTaps: 'handled',
            }}

            messagesContainerStyle={{
              backgroundColor: 'transparent',
            }}

            renderBubble={(props) => (
              <Bubble
                {...props}
                wrapperStyle={{
                  right: { backgroundColor: COLORS.bubbleRight },
                  left: { backgroundColor: COLORS.bubbleLeft },
                }}
                textStyle={{
                  right: { color: COLORS.textPrimary },
                  left: { color: COLORS.textPrimary },
                }}
              />
            )}

            renderInputToolbar={(props) => (
              <InputToolbar
                {...props}
                containerStyle={{
                  backgroundColor: COLORS.inputBg,
                }}
              />
            )}

            renderComposer={(props) => (
              <Composer
                {...props}
                textInputStyle={{
                  color: COLORS.textPrimary,
                }}
              />
            )}

            renderSend={(props) => (
              <Send {...props}>
                <View style={styles.sendBtn}>
                  <Text>↑</Text>
                </View>
              </Send>
            )}

            // ✅ MIC FIX (no overlay)
            renderChatFooter={() => (
              <View style={styles.micContainer}>
                <PulseRing active={audioRecorder.isRecording} />

                <Animated.View style={{ transform: [{ scale: micScale }] }}>
                  <TouchableOpacity
                    style={styles.micButton}
                    onLongPress={startRecording}
                    onPressOut={stopRecording}
                  >
                    <Text style={{ color: '#fff' }}>
                      {audioRecorder.isRecording ? '■' : '●'}
                    </Text>
                  </TouchableOpacity>
                </Animated.View>

                <Text style={styles.micText}>
                  {audioRecorder.isRecording ? 'Release to send' : 'Hold'}
                </Text>
              </View>
            )}
          />
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

// ── STYLES ─────────────────────────
const styles = StyleSheet.create({
  sendBtn: {
    backgroundColor: '#00e5ff',
    padding: 10,
    borderRadius: 20,
    marginRight: 5,
  },
  micContainer: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  micButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#f72585',
    justifyContent: 'center',
    alignItems: 'center',
  },
  micText: {
    color: '#aaa',
    fontSize: 10,
    marginTop: 4,
  },
});