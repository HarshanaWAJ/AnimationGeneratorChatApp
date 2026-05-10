import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, StyleSheet, TouchableOpacity, Text, Image,
  ActivityIndicator, Platform, Animated, Dimensions,
  StatusBar, KeyboardAvoidingView,
} from 'react-native';
import { GiftedChat, Bubble, Send, InputToolbar, Composer } from 'react-native-gifted-chat';
import { useAudioRecorder, useAudioPlayer, RecordingPresets } from 'expo-audio';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import io from 'socket.io-client';
import { sendMessage, getMessages } from '../services/chat';
import { getProfile } from '../services/auth';
import config from '../utils/config';
import { moderateScale, scale, verticalScale } from '../utils/responsive';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IS_WEB = Platform.OS === 'web';

const COLORS = {
  bg: '#070910', surface: '#0d1117', glass: 'rgba(255,255,255,0.04)',
  glassStroke: 'rgba(255,255,255,0.07)', cyan: '#00e5ff',
  cyanDim: 'rgba(0,229,255,0.15)', magenta: '#f72585',
  textPrimary: '#e8f4f8', textMuted: '#5a7080',
  bubbleRight: '#0a2233', bubbleLeft: 'rgba(255,255,255,0.05)',
  inputBg: '#0c1520',
};

const HEADER_HEIGHT = 68;

const AudioMessageBubble = ({ currentMessage }) => {
  const player = useAudioPlayer(currentMessage.audio);

  if (!currentMessage.audio) return null;

  return (
    <View style={styles.audioWrapper}>
      <TouchableOpacity
        style={styles.audioBtn}
        onPress={() => {
          if (player.playing) player.pause();
          else player.play();
        }}
      >
        <Text style={styles.audioBtnText}>{player.playing ? '⏸️ Pause' : '▶️ Play'}</Text>
      </TouchableOpacity>
      <Text style={styles.audioText}>Voice Message</Text>
    </View>
  );
};

export default function ChatRoom({ route, navigation }) {
  const { recipientId, recipientName } = route.params || {};
  const [messages, setMessages] = useState([]);
  const [user, setUser] = useState(null);
  const [socket, setSocket] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const micScale = useRef(new Animated.Value(1)).current;
  const insets = useSafeAreaInsets?.() ?? { top: 0, bottom: 0 };

  useEffect(() => {
    const init = async () => {
      const profile = await getProfile();
      setUser(profile);
      await loadMessages();
      setIsLoading(false);
    };
    init();
  }, []);

  useEffect(() => {
    const newSocket = io(config.SOCKET_URL, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
    });
    setSocket(newSocket);
    newSocket.on('connect', () => newSocket.emit('join_room', recipientId));
    newSocket.on('receive_message', (data) =>
      setMessages((prev) => {
        const newMsg = formatMessage(data);
        if (prev.some((m) => m._id === newMsg._id)) return prev;
        return GiftedChat.append(prev, newMsg);
      })
    );
    return () => { newSocket.removeAllListeners(); newSocket.disconnect(); };
  }, [recipientId]);

  useEffect(() => {
    if (!IS_WEB || !socket) return;
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') socket.connect();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [socket]);

  const loadMessages = async () => {
    const data = await getMessages(recipientId);
    setMessages(data.map(formatMessage).reverse());
  };

  const formatMessage = (msg) => ({
    _id: msg._id, text: msg.text,
    createdAt: new Date(msg.createdAt),
    user: { _id: msg.sender?._id || msg.sender },
    image: msg.gifUrl, audio: msg.audioUrl,
  });

  const onSend = useCallback(async (msgs = []) => {
    const msg = msgs[0];
    const saved = await sendMessage({ receiverId: recipientId, type: 'text', text: msg.text });
    setMessages((prev) => {
      const newMsg = formatMessage(saved);
      if (prev.some((m) => m._id === newMsg._id)) return prev;
      return GiftedChat.append(prev, newMsg);
    });
  }, [recipientId]);

  const animateMic = (active) => {
    Animated.spring(micScale, { toValue: active ? 1.2 : 1, useNativeDriver: true }).start();
  };
  const startRecording = async () => {
    await audioRecorder.prepare(); await audioRecorder.record(); animateMic(true);
  };
  const stopRecording = async () => {
    if (!audioRecorder.isRecording) return;
    animateMic(false);
    await audioRecorder.stop();
    const uri = audioRecorder.uri;
    if (uri) {
      const saved = await sendMessage({ receiverId: recipientId, type: 'audio', audioUri: uri });
      setMessages((prev) => {
        const newMsg = formatMessage(saved);
        if (prev.some((m) => m._id === newMsg._id)) return prev;
        return GiftedChat.append(prev, newMsg);
      });
    }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation?.goBack()}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{recipientName || 'Chat'}</Text>
        <View style={{ width: moderateScale(40) }} />
      </View>

      {/* ── FIX 1: behavior="padding" on ALL platforms ── */}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior="padding"
        keyboardVerticalOffset={
          Platform.OS === 'ios'
            ? insets.top + HEADER_HEIGHT   // iOS: account for notch + header
            : HEADER_HEIGHT                // Android: just the header
        }
      >
        {isLoading ? (
          <ActivityIndicator color={COLORS.cyan} style={styles.loader} />
        ) : (
          <GiftedChat
            messages={messages}
            onSend={(msgs) => onSend(msgs)}
            user={{ _id: user?._id || 'temp' }}
            inverted={!IS_WEB}
            isKeyboardInternallyHandled={false}
            // ── FIX 2: bottomOffset on Android too ──
            bottomOffset={
              Platform.OS === 'ios'
                ? insets.bottom
                : insets.bottom + 8
            }
            listViewProps={{ keyboardShouldPersistTaps: 'handled' }}
            messagesContainerStyle={{ backgroundColor: 'transparent' }}

            renderBubble={(props) => (
              <Bubble
                {...props}
                wrapperStyle={{
                  right: { backgroundColor: COLORS.bubbleRight, padding: moderateScale(2) },
                  left: { backgroundColor: COLORS.bubbleLeft, padding: moderateScale(2) },
                }}
                textStyle={{
                  right: { color: COLORS.textPrimary },
                  left: { color: COLORS.textPrimary },
                }}
              />
            )}

            renderMessageImage={(props) => {
              if (!props.currentMessage.image) return null;
              return (
                <View style={styles.imageWrapper}>
                  <Image
                    source={{ uri: props.currentMessage.image }}
                    style={styles.messageImage}
                    resizeMode="contain"
                  />
                </View>
              );
            }}

            renderMessageAudio={(props) => <AudioMessageBubble {...props} />}

            renderActions={() => (
              <View style={styles.actionContainer}>
                <TouchableOpacity
                  style={styles.micSmallBtn}
                  onLongPress={startRecording}
                  onPressOut={stopRecording}
                >
                  <Text style={styles.micIcon}>
                    {audioRecorder.isRecording ? '⏹️' : '🎤'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            // ── FIX 3: paddingBottom = insets.bottom pushes toolbar above nav bar ──
            renderInputToolbar={(props) => (
              <InputToolbar
                {...props}
                containerStyle={[
                  styles.inputToolbar,
                  { paddingBottom: insets.bottom },
                ]}
              />
            )}

            renderComposer={(props) => (
              <Composer {...props} textInputStyle={styles.composerInput} />
            )}

            renderSend={(props) => (
              <Send {...props} containerStyle={styles.sendContainer}>
                <View style={styles.sendBtn}>
                  <Text style={styles.sendLabel}>Send</Text>
                </View>
              </Send>
            )}
          />
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  flex: { flex: 1 },
  loader: { flex: 1, alignSelf: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: moderateScale(16), paddingVertical: moderateScale(12),
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  backBtn: {
    width: moderateScale(40), height: moderateScale(40), justifyContent: 'center', alignItems: 'center',
    backgroundColor: COLORS.cyanDim, borderRadius: moderateScale(12),
  },
  backArrow: { color: COLORS.cyan, fontSize: moderateScale(24), fontWeight: 'bold' },
  headerTitle: { flex: 1, color: '#fff', fontSize: moderateScale(18), fontWeight: 'bold', textAlign: 'center' },
  inputToolbar: {
    backgroundColor: COLORS.inputBg,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    // NOTE: paddingBottom is set dynamically via insets.bottom in renderInputToolbar
  },
  composerInput: { color: COLORS.textPrimary, fontSize: moderateScale(15) },
  sendContainer: { justifyContent: 'center' },
  sendBtn: {
    backgroundColor: COLORS.cyan,
    paddingVertical: moderateScale(8), paddingHorizontal: moderateScale(16),
    borderRadius: moderateScale(20), marginRight: moderateScale(10), marginBottom: moderateScale(5),
  },
  sendLabel: { color: '#000', fontWeight: 'bold', fontSize: moderateScale(14) },
  actionContainer: {
    justifyContent: 'center', alignItems: 'center',
    height: moderateScale(44), width: moderateScale(44), marginBottom: 0,
  },
  micSmallBtn: {
    width: moderateScale(36), height: moderateScale(36), borderRadius: moderateScale(18),
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center', alignItems: 'center',
  },
  micIcon: { fontSize: moderateScale(16) },
  imageWrapper: { borderRadius: moderateScale(12), overflow: 'hidden', backgroundColor: '#fff', margin: moderateScale(4) },
  messageImage: { width: scale(220), height: verticalScale(160) },
  audioWrapper: {
    flexDirection: 'row', alignItems: 'center',
    padding: moderateScale(8), backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: moderateScale(12), margin: moderateScale(4), minWidth: moderateScale(150)
  },
  audioBtn: {
    backgroundColor: COLORS.cyan, paddingVertical: moderateScale(6),
    paddingHorizontal: moderateScale(12), borderRadius: moderateScale(16),
    marginRight: moderateScale(10)
  },
  audioBtnText: { color: '#000', fontWeight: 'bold', fontSize: moderateScale(12) },
  audioText: { color: COLORS.textPrimary, fontSize: moderateScale(14) },
});