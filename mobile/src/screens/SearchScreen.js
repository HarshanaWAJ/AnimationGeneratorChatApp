import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { searchUsers, sendFriendRequest, removeFriend } from '../services/user';
import { moderateScale } from '../utils/responsive';

export default function SearchScreen({ navigation }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (!query) return;
    setLoading(true);
    try {
      const data = await searchUsers(query);
      setResults(data);
    } catch (err) {
      Alert.alert('Search Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddFriend = async (userId) => {
    try {
      await sendFriendRequest(userId);
      Alert.alert('Success', 'Friend request sent!');
      handleSearch();
    } catch (err) {
      Alert.alert('Error', err.message);
    }
  };

  const handleUnfriend = async (userId) => {
    try {
      await removeFriend(userId);
      Alert.alert('Success', 'User removed from friends');
      handleSearch();
    } catch (err) {
      Alert.alert('Error', err.message);
    }
  };

  const renderAction = (item) => {
    if (item.status === 'friend') {
      return (
        <TouchableOpacity
          style={styles.unfriendButton}
          onPress={() => handleUnfriend(item._id)}
          activeOpacity={0.8}
        >
          <Text style={styles.unfriendText}>Unfriend</Text>
        </TouchableOpacity>
      );
    } else if (item.status === 'pending') {
      return (
        <View style={styles.pendingBadge}>
          <Text style={styles.pendingText}>Pending</Text>
        </View>
      );
    } else {
      return (
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => handleAddFriend(item._id)}
          activeOpacity={0.8}
        >
          <Text style={styles.addText}>Add +</Text>
        </TouchableOpacity>
      );
    }
  };

  const renderItem = ({ item }) => (
    <View style={styles.userCard}>
      <View style={styles.userInfo}>
        <Text style={styles.userName}>{item.username}</Text>
        <Text style={styles.userEmail}>{item.email}</Text>
      </View>
      {renderAction(item)}
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <Text style={styles.backArrow}>←</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Find Friends</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Search Bar */}
        <View style={styles.searchBar}>
          <TextInput
            style={styles.input}
            placeholder="Search by username or email..."
            placeholderTextColor="#4a5568"
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
            autoCapitalize="none"
          />
          <TouchableOpacity
            style={[styles.searchBtn, loading && styles.searchBtnDisabled]}
            onPress={handleSearch}
            disabled={loading}
            activeOpacity={0.8}
          >
            <Text style={styles.searchBtnText}>{loading ? '...' : '🔍'}</Text>
          </TouchableOpacity>
        </View>

        {/* Results */}
        <FlatList
          data={results}
          renderItem={renderItem}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>👥</Text>
              <Text style={styles.emptyText}>
                {query ? 'No users found' : 'Search to find friends'}
              </Text>
            </View>
          }
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#05060f',
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: moderateScale(20),
    paddingVertical: moderateScale(16),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  backBtn: {
    width: moderateScale(40),
    height: moderateScale(40),
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,224,255,0.08)',
    borderRadius: moderateScale(12),
  },
  backArrow: {
    color: '#00e0ff',
    fontSize: moderateScale(22),
    fontWeight: 'bold',
  },
  title: {
    flex: 1,
    color: '#fff',
    fontSize: moderateScale(20),
    fontWeight: '800',
    textAlign: 'center',
    marginHorizontal: moderateScale(8),
  },
  headerSpacer: {
    width: moderateScale(40),
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: moderateScale(20),
    paddingVertical: moderateScale(16),
    gap: moderateScale(10),
  },
  input: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: moderateScale(14),
    paddingHorizontal: moderateScale(16),
    paddingVertical: moderateScale(13),
    color: '#fff',
    fontSize: moderateScale(14),
  },
  searchBtn: {
    backgroundColor: '#00e0ff',
    width: moderateScale(48),
    height: moderateScale(48),
    borderRadius: moderateScale(14),
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
  },
  searchBtnDisabled: {
    opacity: 0.6,
  },
  searchBtnText: {
    fontSize: moderateScale(18),
  },
  listContent: {
    paddingHorizontal: moderateScale(20),
    paddingBottom: moderateScale(30),
    flexGrow: 1,
  },
  userCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    padding: moderateScale(16),
    borderRadius: moderateScale(16),
    marginBottom: moderateScale(10),
  },
  userInfo: {
    flex: 1,
    marginRight: moderateScale(12),
  },
  userName: {
    color: '#fff',
    fontSize: moderateScale(15),
    fontWeight: '700',
  },
  userEmail: {
    color: '#8b9cc8',
    fontSize: moderateScale(12),
    marginTop: moderateScale(2),
  },
  addButton: {
    backgroundColor: '#00e0ff',
    paddingVertical: moderateScale(8),
    paddingHorizontal: moderateScale(16),
    borderRadius: moderateScale(10),
  },
  addText: {
    color: '#05060f',
    fontSize: moderateScale(13),
    fontWeight: '800',
  },
  unfriendButton: {
    backgroundColor: 'rgba(255,75,75,0.12)',
    paddingVertical: moderateScale(8),
    paddingHorizontal: moderateScale(16),
    borderRadius: moderateScale(10),
    borderWidth: 1,
    borderColor: 'rgba(255,75,75,0.4)',
  },
  unfriendText: {
    color: '#ff4b4b',
    fontSize: moderateScale(13),
    fontWeight: '700',
  },
  pendingBadge: {
    backgroundColor: 'rgba(139,156,200,0.12)',
    paddingVertical: moderateScale(8),
    paddingHorizontal: moderateScale(16),
    borderRadius: moderateScale(10),
    borderWidth: 1,
    borderColor: 'rgba(139,156,200,0.3)',
  },
  pendingText: {
    color: '#8b9cc8',
    fontSize: moderateScale(13),
    fontWeight: '700',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: moderateScale(80),
  },
  emptyIcon: {
    fontSize: moderateScale(40),
    marginBottom: moderateScale(16),
  },
  emptyText: {
    color: '#8b9cc8',
    fontSize: moderateScale(15),
    textAlign: 'center',
  },
});
