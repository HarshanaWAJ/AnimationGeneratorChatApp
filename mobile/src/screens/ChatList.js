import React, { useState, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
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
import { moderateScale } from '../utils/responsive';

export default function ChatList({ navigation }) {
  const [friends, setFriends] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const { signOut, user } = useAuth();

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
          <View>
            <Text style={styles.title}>Messages</Text>
            {user?.username && <Text style={styles.userNameHeader}>Logged in as: {user.username}</Text>}
          </View>
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
              <Ionicons name="log-out-outline" size={22} color="#00e0ff" />
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
    paddingHorizontal: moderateScale(20),
    paddingVertical: moderateScale(16),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  title: {
    color: '#00e0ff',
    fontSize: moderateScale(28),
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  userNameHeader: {
    color: '#8b9cc8',
    fontSize: moderateScale(13),
    marginTop: moderateScale(2),
    fontWeight: '500',
  },
  headerBtns: {
    flexDirection: 'row',
  },
  iconBtn: {
    marginLeft: moderateScale(16),
    width: moderateScale(44),
    height: moderateScale(44),
    borderRadius: moderateScale(22),
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconText: {
    fontSize: moderateScale(20),
  },
  listContent: {
    paddingHorizontal: moderateScale(20),
    paddingTop: moderateScale(16),
    paddingBottom: moderateScale(40),
    flexGrow: 1,
  },
  chatCardContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: moderateScale(12),
  },
  chatCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    padding: moderateScale(12),
    borderRadius: moderateScale(16),
  },
  avatar: {
    width: moderateScale(52),
    height: moderateScale(52),
    borderRadius: moderateScale(26),
    backgroundColor: '#1a1b2e',
  },
  chatInfo: {
    flex: 1,
    marginLeft: moderateScale(14),
  },
  userName: {
    color: '#fff',
    fontSize: moderateScale(16),
    fontWeight: '700',
  },
  lastMsg: {
    color: '#8b9cc8',
    fontSize: moderateScale(13),
    marginTop: moderateScale(4),
  },
  removeBtn: {
    padding: moderateScale(12),
    marginLeft: moderateScale(4),
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeBtnText: {
    color: '#ff4b4b',
    fontSize: moderateScale(28),
    lineHeight: moderateScale(28),
    fontWeight: '300',
  },
  pendingSection: {
    marginBottom: moderateScale(20),
  },
  sectionTitle: {
    color: '#8b9cc8',
    fontSize: moderateScale(13),
    fontWeight: '700',
    marginBottom: moderateScale(12),
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginVertical: moderateScale(16),
  },
  pendingCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(0,224,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(0,224,255,0.1)',
    padding: moderateScale(12),
    borderRadius: moderateScale(14),
    marginBottom: moderateScale(10),
  },
  pendingInfo: {
    flex: 1,
    marginRight: moderateScale(10),
  },
  pendingName: {
    color: '#fff',
    fontWeight: '700',
    fontSize: moderateScale(15),
  },
  pendingSub: {
    color: '#8b9cc8',
    fontSize: moderateScale(12),
    marginTop: moderateScale(2),
  },
  pendingActions: {
    flexDirection: 'row',
  },
  acceptBtn: {
    backgroundColor: '#00e0ff',
    paddingVertical: moderateScale(8),
    paddingHorizontal: moderateScale(16),
    borderRadius: moderateScale(10),
    marginRight: moderateScale(8),
  },
  rejectBtn: {
    backgroundColor: 'rgba(255,75,75,0.15)',
    paddingVertical: moderateScale(8),
    paddingHorizontal: moderateScale(16),
    borderRadius: moderateScale(10),
  },
  actionText: {
    color: '#05060f',
    fontSize: moderateScale(13),
    fontWeight: '800',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: moderateScale(80),
  },
  emptyIcon: {
    fontSize: moderateScale(48),
    marginBottom: moderateScale(16),
  },
  emptyText: {
    color: '#8b9cc8',
    fontSize: moderateScale(16),
    marginBottom: moderateScale(24),
    fontWeight: '500',
  },
  findBtn: {
    backgroundColor: '#00e0ff',
    paddingVertical: moderateScale(14),
    paddingHorizontal: moderateScale(32),
    borderRadius: moderateScale(14),
    shadowColor: '#00e0ff',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  findBtnText: {
    color: '#05060f',
    fontWeight: '800',
    fontSize: moderateScale(15),
  },
});
