import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Image,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  getFriends,
  getPendingRequests,
  acceptFriendRequest,
  rejectFriendRequest,
  removeFriend,
} from '../services/user';
import { useAuth } from '../context/AuthContext';

export default function ChatList({ navigation }) {
  const [friends, setFriends] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const { signOut } = useAuth();

  useEffect(() => {
    loadFriends();
  }, []);

  const loadFriends = async () => {
    setRefreshing(true);
    try {
      const [friendsData, requestsData] = await Promise.all([
        getFriends(),
        getPendingRequests(),
      ]);
      setFriends(friendsData);
      setPendingRequests(requestsData);
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setRefreshing(false);
    }
  };

  const handleAccept = async (requestId) => {
    try {
      await acceptFriendRequest(requestId);
      loadFriends();
    } catch (err) {
      Alert.alert('Error', err.message);
    }
  };

  const handleReject = async (requestId) => {
    try {
      await rejectFriendRequest(requestId);
      loadFriends();
    } catch (err) {
      Alert.alert('Error', err.message);
    }
  };

  const handleRemoveFriend = (friendId, username) => {
    const confirmRemove = () => {
      removeFriend(friendId)
        .then(() => loadFriends())
        .catch((err) => Alert.alert('Error', err.message));
    };

    if (Platform.OS === 'web') {
      if (window.confirm(`Unfriend ${username}?`)) confirmRemove();
    } else {
      Alert.alert('Unfriend', `Are you sure you want to remove ${username}?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: confirmRemove },
      ]);
    }
  };

  const handleLogout = () => {
    if (Platform.OS === 'web') {
      const confirmed = window.confirm('Are you sure you want to log out?');
      if (confirmed) signOut();
    } else {
      Alert.alert('Logout', 'Are you sure you want to log out?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Logout', style: 'destructive', onPress: () => signOut() },
      ]);
    }
  };

  const renderItem = ({ item }) => (
    <View style={styles.chatCardContainer}>
      <TouchableOpacity
        style={styles.chatCard}
        activeOpacity={0.7}
        onPress={() =>
          navigation.navigate('ChatRoom', {
            recipientId: item._id,
            recipientName: item.username,
          })
        }
      >
        <Image source={{ uri: item.avatar }} style={styles.avatar} />
        <View style={styles.chatInfo}>
          <Text style={styles.userName} numberOfLines={1}>{item.username}</Text>
          <Text style={styles.lastMsg} numberOfLines={1}>Tap to start chatting...</Text>
        </View>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.removeBtn}
        onPress={() => handleRemoveFriend(item._id, item.username)}
        activeOpacity={0.6}
      >
        <Text style={styles.removeBtnText}>×</Text>
      </TouchableOpacity>
    </View>
  );

  const renderPendingItem = ({ item }) => (
    <View style={styles.pendingCard}>
      <View style={styles.pendingInfo}>
        <Text style={styles.pendingName} numberOfLines={1}>{item.sender.username}</Text>
        <Text style={styles.pendingSub}>wants to be friends</Text>
      </View>
      <View style={styles.pendingActions}>
        <TouchableOpacity
          style={styles.acceptBtn}
          onPress={() => handleAccept(item._id)}
          activeOpacity={0.8}
        >
          <Text style={styles.actionText}>Accept</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.rejectBtn}
          onPress={() => handleReject(item._id)}
          activeOpacity={0.8}
        >
          <Text style={styles.actionText}>Reject</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Messages</Text>
          <View style={styles.headerBtns}>
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => navigation.navigate('Search')}
              activeOpacity={0.6}
            >
              <Text style={styles.iconText}>🔍</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={handleLogout}
              activeOpacity={0.6}
            >
              <Text style={styles.iconText}>🚪</Text>
            </TouchableOpacity>
          </View>
        </View>

        <FlatList
          data={friends}
          renderItem={renderItem}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            pendingRequests.length > 0 && (
              <View style={styles.pendingSection}>
                <Text style={styles.sectionTitle}>
                  Friend Requests ({pendingRequests.length})
                </Text>
                {pendingRequests.map((item) => (
                  <View key={item._id}>{renderPendingItem({ item })}</View>
                ))}
                <View style={styles.divider} />
                <Text style={styles.sectionTitle}>Friends</Text>
              </View>
            )
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={loadFriends}
              tintColor="#00e0ff"
              colors={['#00e0ff']}
            />
          }
          ListEmptyComponent={
            !refreshing && (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyIcon}>📭</Text>
                <Text style={styles.emptyText}>No friends yet!</Text>
                <TouchableOpacity
                  style={styles.findBtn}
                  onPress={() => navigation.navigate('Search')}
                  activeOpacity={0.8}
                >
                  <Text style={styles.findBtnText}>Find Friends</Text>
                </TouchableOpacity>
              </View>
            )
          }
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#05060f',
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  title: {
    color: '#00e0ff',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  headerBtns: {
    flexDirection: 'row',
  },
  iconBtn: {
    marginLeft: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconText: {
    fontSize: 20,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
    flexGrow: 1,
  },
  chatCardContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  chatCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    padding: 12,
    borderRadius: 16,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#1a1b2e',
  },
  chatInfo: {
    flex: 1,
    marginLeft: 14,
  },
  userName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  lastMsg: {
    color: '#8b9cc8',
    fontSize: 13,
    marginTop: 4,
  },
  removeBtn: {
    padding: 12,
    marginLeft: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeBtnText: {
    color: '#ff4b4b',
    fontSize: 28,
    lineHeight: 28,
    fontWeight: '300',
  },
  pendingSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    color: '#8b9cc8',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginVertical: 16,
  },
  pendingCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(0,224,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(0,224,255,0.1)',
    padding: 12,
    borderRadius: 14,
    marginBottom: 10,
  },
  pendingInfo: {
    flex: 1,
    marginRight: 10,
  },
  pendingName: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  pendingSub: {
    color: '#8b9cc8',
    fontSize: 12,
    marginTop: 2,
  },
  pendingActions: {
    flexDirection: 'row',
  },
  acceptBtn: {
    backgroundColor: '#00e0ff',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginRight: 8,
  },
  rejectBtn: {
    backgroundColor: 'rgba(255,75,75,0.15)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  actionText: {
    color: '#05060f',
    fontSize: 13,
    fontWeight: '800',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 80,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyText: {
    color: '#8b9cc8',
    fontSize: 16,
    marginBottom: 24,
    fontWeight: '500',
  },
  findBtn: {
    backgroundColor: '#00e0ff',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 14,
    shadowColor: '#00e0ff',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  findBtnText: {
    color: '#05060f',
    fontWeight: '800',
    fontSize: 15,
  },
});
