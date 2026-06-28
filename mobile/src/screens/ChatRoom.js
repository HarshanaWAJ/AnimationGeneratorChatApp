import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, StyleSheet, TouchableOpacity, Text, Image,
  ActivityIndicator, Platform, Animated, Dimensions,
  StatusBar, KeyboardAvoidingView, Alert, PanResponder,
} from 'react-native';
import { GiftedChat, Bubble, Send, InputToolbar, Composer } from 'react-native-gifted-chat';
import { useAudioRecorder, RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync } from 'expo-audio';
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



// Renders a message that has an animation GIF + transcribed text
const AnimatedMessageBubble = ({ currentMessage, isRight }) => {
  const bgColor = isRight ? COLORS.bubbleRight : COLORS.bubbleLeft;
  return (
    <View style={[styles.animBubble, { backgroundColor: bgColor, alignSelf: isRight ? 'flex-end' : 'flex-start' }]}>
      <Image
        source={{ uri: currentMessage.image }}
        style={styles.gifImage}
        resizeMode="contain"
      />
      {!!currentMessage.text && currentMessage.text !== '[Voice Message]' && (
        <Text style={styles.animText}>{currentMessage.text}</Text>
      )}
    </View>
  );
};

export default function ChatRoom({ route, navigation }) {
  const { recipientId, recipientName } = route.params || {};
  const [messages, setMessages] = useState([]);
  const [user, setUser] = useState(null);
  const [socket, setSocket] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const micScale = useRef(new Animated.Value(1)).current;
  const isRecordingRef = useRef(false); // tracks whether recording actually started
  const recordingStartTimeRef = useRef(0);
  const insets = useSafeAreaInsets?.() ?? { top: 0, bottom: 0 };
  
  // WhatsApp Voice UX State
  const [isRecordingUI, setIsRecordingUI] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const isCancelledRef = useRef(false);
  const timerRef = useRef(null);

  useEffect(() => {
    if (isRecordingUI) {
      setRecordDuration(0);
      timerRef.current = setInterval(() => setRecordDuration(d => d + 1), 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [isRecordingUI]);

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
    const checkPermissions = async () => {
      try {
        const { granted } = await requestRecordingPermissionsAsync();
        if (granted) {
          await setAudioModeAsync({
            allowsRecording: true,
            playsInSilentMode: true,
          });
        }
      } catch (err) {
        console.warn('Microphone permission check/request failed:', err);
      }
    };
    checkPermissions();
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
    // Add an optimistic placeholder so user sees their text immediately
    const placeholderId = `temp_${Date.now()}`;
    const placeholder = {
      _id: placeholderId,
      text: msg.text,
      createdAt: new Date(),
      user: { _id: (user?.id || user?._id) || 'temp' },
      pending: true,
    };
    setMessages((prev) => GiftedChat.append(prev, [placeholder]));
    setIsSending(true);
    try {
      const saved = await sendMessage({ receiverId: recipientId, type: 'text', text: msg.text });
      const newMsg = formatMessage(saved);
      // Replace placeholder with real message (which has gifUrl → image)
      setMessages((prev) => {
        const filtered = prev.filter((m) => m._id !== placeholderId);
        if (filtered.some((m) => m._id === newMsg._id)) return filtered;
        return GiftedChat.append(filtered, [newMsg]);
      });
    } catch (err) {
      console.error('sendMessage failed:', err);
      // Remove placeholder on error
      setMessages((prev) => prev.filter((m) => m._id !== placeholderId));
    } finally {
      setIsSending(false);
    }
  }, [recipientId, user]);

  const animateMic = (active) => {
    Animated.spring(micScale, { toValue: active ? 1.2 : 1, useNativeDriver: true }).start();
  };
  const startRecording = async () => {
    try {
      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) {
        Alert.alert('Microphone Permission', 'Microphone access is required to send voice messages.');
        setIsRecordingUI(false);
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await audioRecorder.prepareToRecordAsync();
      await audioRecorder.record();
      isRecordingRef.current = true;
      recordingStartTimeRef.current = Date.now();
      animateMic(true);
    } catch (err) {
      isRecordingRef.current = false;
      setIsRecordingUI(false);
      console.error('Failed to start recording:', err);
      Alert.alert('Error', 'Failed to start recording: ' + err.message);
    }
  };

  const stopRecording = async (cancelled = false) => {
    setIsRecordingUI(false);
    slideAnim.setValue(0);
    clearInterval(timerRef.current);

    if (!isRecordingRef.current) return;
    isRecordingRef.current = false;
    animateMic(false);

    // Prevent MediaRecorder crash on Android
    const duration = Date.now() - recordingStartTimeRef.current;
    if (duration < 500) {
      await new Promise(resolve => setTimeout(resolve, 500 - duration));
    }

    try {
      await audioRecorder.stop();
      const uri = audioRecorder.uri;

      if (cancelled) {
        return; // do not send message
      }

      if (!uri) return;

      const placeholderId = `temp_voice_${Date.now()}`;
      const placeholder = {
        _id: placeholderId,
        text: '🎤 Transcribing & animating...',
        createdAt: new Date(),
        user: { _id: (user?.id || user?._id) || 'temp' },
        pending: true,
      };
      setMessages((prev) => GiftedChat.append(prev, [placeholder]));
      setIsSending(true);

      try {
        const saved = await sendMessage({
          receiverId: recipientId,
          type: 'voice',
          audioUri: uri,
        });
        const newMsg = formatMessage(saved);
        setMessages((prev) => {
          const filtered = prev.filter((m) => m._id !== placeholderId);
          if (filtered.some((m) => m._id === newMsg._id)) return filtered;
          return GiftedChat.append(filtered, [newMsg]);
        });
      } catch (err) {
        setMessages((prev) => prev.filter((m) => m._id !== placeholderId));
        const errMsg = err?.message || 'Voice message failed. Please speak clearly and try again.';
        Alert.alert('Voice Message Failed', errMsg);
        console.error('Voice sendMessage failed:', err);
      } finally {
        setIsSending(false);
      }
    } catch (err) {
      console.error('Failed to stop recording:', err);
      if (err.message && err.message.includes('stop failed')) {
        return;
      }
      Alert.alert('Error', 'Failed to stop recording: ' + err.message);
    }
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: async () => {
        isCancelledRef.current = false;
        slideAnim.setValue(0);
        setIsRecordingUI(true);
        await startRecording();
      },
      onPanResponderMove: (e, gestureState) => {
        if (gestureState.dx < 0) {
          slideAnim.setValue(gestureState.dx);
          if (gestureState.dx < -100 && !isCancelledRef.current) {
            isCancelledRef.current = true;
            stopRecording(true); 
          }
        }
      },
      onPanResponderRelease: () => {
        if (!isCancelledRef.current) {
          stopRecording(false);
        }
      },
      onPanResponderTerminate: () => {
        if (!isCancelledRef.current) {
          stopRecording(true);
        }
      }
    })
  ).current;

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
            user={{ _id: (user?.id || user?._id) || 'temp' }}
            inverted={!IS_WEB}
            isKeyboardInternallyHandled={false}
            disableComposer={isSending}
            // ── FIX 2: bottomOffset on Android too ──
            bottomOffset={
              Platform.OS === 'ios'
                ? insets.bottom
                : insets.bottom + 8
            }
            listViewProps={{ keyboardShouldPersistTaps: 'handled' }}
            messagesContainerStyle={{ backgroundColor: 'transparent' }}

            renderBubble={(props) => {
              // If this message has a GIF animation and user is not a normal person, use the custom animated bubble
              if (props.currentMessage.image && user?.userType !== 'normal') {
                const isRight = props.position === 'right' || props.currentMessage.user._id === ((user?.id || user?._id) || 'temp');
                return (
                  <AnimatedMessageBubble
                    currentMessage={props.currentMessage}
                    isRight={isRight}
                  />
                );
              }
              // Normal text bubble
              return (
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
              );
            }}

            /* renderMessageImage is suppressed — GIF rendering handled inside renderBubble */
            renderMessageImage={() => null}

            /* renderActions is now removed, mic is in renderSend */
            renderActions={() => null}

            renderInputToolbar={(props) => (
              <View>
                <InputToolbar
                  {...props}
                  containerStyle={[
                    styles.inputToolbar,
                    { paddingBottom: insets.bottom },
                  ]}
                />
                {isRecordingUI && (
                  <View style={[styles.recordingOverlay, { bottom: insets.bottom }]}>
                    <Animated.Text style={[styles.recordingTime, { opacity: micScale }]}>
                      🔴 0:{recordDuration.toString().padStart(2, '0')}
                    </Animated.Text>
                    <Text style={styles.slideCancelText}>
                      {'< Slide to cancel'}
                    </Text>
                  </View>
                )}
              </View>
            )}

            renderComposer={(props) => (
              <Composer 
                {...props} 
                textInputStyle={{
                  color: '#ffffff',
                  fontSize: 16,
                  opacity: isRecordingUI ? 0 : 1
                }} 
                textInputProps={{ 
                  placeholderTextColor: '#ffffff',
                  style: { 
                    color: '#ffffff', 
                    fontSize: 16, 
                    opacity: isRecordingUI ? 0 : 1 
                  },
                  ...props.textInputProps
                }} 
              />
            )}

            renderSend={(props) => {
              if (props.text && props.text.trim().length > 0) {
                return (
                  <Send {...props} containerStyle={styles.sendContainer}>
                    <View style={styles.sendBtn}>
                      <Text style={styles.sendLabel}>Send</Text>
                    </View>
                  </Send>
                );
              }
              // WhatsApp style: show mic when empty
              return (
                <Animated.View
                  {...panResponder.panHandlers}
                  style={[styles.whatsappMicBtnContainer, { transform: [{ translateX: slideAnim }] }]}
                >
                  <Animated.View style={[styles.whatsappMicBtn, isRecordingUI && { transform: [{ scale: micScale }] }]}>
                    <Text style={styles.whatsappMicIcon}>🎤</Text>
                  </Animated.View>
                </Animated.View>
              );
            }}
          />
        )}
      </KeyboardAvoidingView>

      {/* Sending overlay — shown while GIF is being generated */}
      {isSending && (
        <View style={styles.sendingOverlay}>
          <ActivityIndicator color={COLORS.cyan} size="large" />
          <Text style={styles.sendingText}>🎬 Generating animation...</Text>
        </View>
      )}
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
  composerInput: { color: '#ffffff', fontSize: moderateScale(15) },
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
  // Animation GIF bubble styles
  animBubble: {
    borderRadius: moderateScale(14),
    overflow: 'hidden',
    margin: moderateScale(4),
    maxWidth: scale(260),
    alignItems: 'center',
    padding: moderateScale(6),
  },
  gifImage: {
    width: scale(240),
    height: scale(240),
    borderRadius: moderateScale(10),
  },
  animText: {
    color: COLORS.textPrimary,
    fontSize: moderateScale(13),
    textAlign: 'center',
    marginTop: moderateScale(6),
    paddingHorizontal: moderateScale(8),
    fontStyle: 'italic',
  },
  sendingOverlay: {
    position: 'absolute',
    bottom: 80,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0,229,255,0.12)',
    borderWidth: 1,
    borderColor: COLORS.cyan,
    borderRadius: moderateScale(14),
    paddingVertical: moderateScale(14),
    paddingHorizontal: moderateScale(20),
    flexDirection: 'row',
    alignItems: 'center',
  },
  sendingText: {
    color: '#ffffff',
    fontSize: moderateScale(14),
    fontWeight: '600',
    marginLeft: moderateScale(12),
  },
  composerContainer: { flex: 1, justifyContent: 'center' },
  whatsappMicBtnContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    height: moderateScale(44),
    width: moderateScale(44),
    marginRight: moderateScale(8),
    marginBottom: moderateScale(3),
  },
  whatsappMicBtn: {
    width: moderateScale(40),
    height: moderateScale(40),
    borderRadius: moderateScale(20),
    backgroundColor: COLORS.cyan,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.cyan,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 4,
  },
  whatsappMicIcon: { fontSize: moderateScale(18), color: '#000' },
  recordingOverlay: {
    position: 'absolute',
    left: moderateScale(10),
    right: moderateScale(60),
    top: moderateScale(6),
    height: moderateScale(44),
    backgroundColor: COLORS.inputBg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: moderateScale(10),
    zIndex: 10,
  },
  recordingTime: {
    color: '#ff4444',
    fontSize: moderateScale(15),
    fontWeight: 'bold',
  },
  slideCancelText: {
    color: COLORS.textMuted,
    fontSize: moderateScale(14),
    marginRight: moderateScale(20),
  },
});