import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Image, ActivityIndicator, Alert } from 'react-native';
import { GiftedChat, Bubble, Send } from 'react-native-gifted-chat';
import { useAudioRecorder, AudioModule, RecordingPresets } from 'expo-audio';
import io from 'socket.io-client';
import { sendMessage, getMessages } from '../services/chat';
import { getProfile } from '../services/auth';
import config from '../utils/config';

export default function ChatRoom({ route }) {
  const { recipientId, recipientName } = route.params || { recipientId: 'some_id', recipientName: 'Friend' };
  const [messages, setMessages] = useState([]);
  const [user, setUser] = useState(null);
  const [socket, setSocket] = useState(null);

  // --- Audio Recording Hook (Modern Expo SDK 54) ---
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  useEffect(() => {
    // 1. Load User Profile
    const init = async () => {
      const profile = await getProfile();
      setUser(profile);
      loadMessages();
    };
    init();

    // 2. Setup Socket
    const newSocket = io(config.SOCKET_URL);
    setSocket(newSocket);
    newSocket.emit('join_room', recipientId);

    newSocket.on('receive_message', (data) => {
      setMessages(previousMessages => GiftedChat.append(previousMessages, formatMessage(data)));
    });

    return () => newSocket.disconnect();
  }, [recipientId]);

  const loadMessages = async () => {
    try {
      const data = await getMessages(recipientId);
      setMessages(data.map(formatMessage).reverse());
    } catch (err) {
      console.error('Failed to load messages:', err);
    }
  };

  const formatMessage = (msg) => ({
    _id: msg._id,
    text: msg.text,
    createdAt: new Date(msg.createdAt),
    user: { _id: msg.sender, name: 'User' },
    image: msg.gifUrl,
    audio: msg.audioUrl,
  });

  const onSend = useCallback(async (newMessages = []) => {
    const msg = newMessages[0];
    if (!user) return;
    try {
      const savedMsg = await sendMessage({
        receiverId: recipientId,
        type: 'text',
        text: msg.text
      });
      setMessages(previousMessages => GiftedChat.append(previousMessages, formatMessage(savedMsg)));
    } catch (err) {
      console.error('Send failed:', err);
    }
  }, [recipientId, user]);

  // --- Voice Recording Logic ---
  const startRecording = async () => {
    // Fulfilling: "ask before the confirm"
    const status = await AudioModule.getPermissionsAsync();
    
    if (status.status !== 'granted') {
      Alert.alert(
        'Microphone Permission',
        'Antigravity Chat needs access to your microphone to send voice messages. Transcripts will be used to generate your animations.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Enable', onPress: () => requestAndStart() }
        ]
      );
      return;
    }
    requestAndStart();
  };

  const requestAndStart = async () => {
    try {
      const { status } = await AudioModule.requestPermissionsAsync();
      if (status !== 'granted') return Alert.alert('Permission denied', 'Cannot record without microphone access.');
      
      // Configure for WAV for local STT compatibility
      await audioRecorder.prepare({
        extension: '.wav',
        sampleRate: 44100,
        numberOfChannels: 1,
        bitRate: 128000,
        android: {
          extension: '.wav',
          outputFormat: 'wav', // Use a standard WAV format
          audioEncoder: 'aac' // Or 'default'
        },
        ios: {
          extension: '.wav',
          outputFormat: 'linear-pcm',
          audioQuality: 'high'
        }
      });

      await audioRecorder.record();
    } catch (err) {
      console.error('Failed to start recording', err);
    }
  };

  const stopRecording = async () => {
    if (!audioRecorder.isRecording) return;
    try {
      await audioRecorder.stop();
      const uri = audioRecorder.uri;
      
      if (uri) {
        const savedMsg = await sendMessage({
          receiverId: recipientId,
          type: 'voice',
          audioUri: uri
        });
        setMessages(previousMessages => GiftedChat.append(previousMessages, formatMessage(savedMsg)));
      }
    } catch (err) {
      console.error('Voice send failed:', err);
    }
  };

  // --- Custom UI ---
  const renderBubble = (props) => (
    <Bubble
      {...props}
      wrapperStyle={{
        right: { backgroundColor: '#00e0ff' },
        left: { backgroundColor: 'rgba(255,255,255,0.1)' }
      }}
      textStyle={{
        right: { color: '#fff' },
        left: { color: '#fff' }
      }}
    />
  );

  const renderMessageImage = (props) => {
    if (props.currentMessage.image) {
      return (
        <View style={styles.gifContainer}>
          <Image source={{ uri: props.currentMessage.image }} style={styles.gif} />
          <Text style={styles.gifLabel}>✦ Antigravity Animation</Text>
        </View>
      );
    }
    return null;
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>{recipientName}</Text>
      </View>

      <GiftedChat
        messages={messages}
        onSend={messages => onSend(messages)}
        user={{ 
          _id: user?._id || 'temp',
          name: user?.username || 'Me'
        }}
        renderBubble={renderBubble}
        renderMessageImage={renderMessageImage}
        placeholder="Type a message or hold to record..."
        listViewProps={{
          style: {
            flex: 1,
            overflow: 'auto',
          },
        }}
      />

      <TouchableOpacity 
        style={[styles.micButton, audioRecorder.isRecording && styles.micButtonActive]}
        onLongPress={startRecording}
        onPressOut={stopRecording}
      >
        <Text style={styles.micIcon}>{audioRecorder.isRecording ? '⏹' : '🎤'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#05060f' },
  header: { padding: 50, backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center' },
  headerText: { color: '#00e0ff', fontSize: 18, fontWeight: 'bold' },
  micButton: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#00e0ff',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
  },
  micButtonActive: { backgroundColor: '#f72585', transform: [{ scale: 1.2 }] },
  micIcon: { fontSize: 24, color: '#fff' },
  gifContainer: { padding: 5, borderRadius: 10 },
  gif: { width: 200, height: 200, borderRadius: 10 },
  gifLabel: { color: '#00e0ff', fontSize: 10, textAlign: 'center', marginTop: 4 }
});
