import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl, Image, Alert, Platform } from 'react-native';
import { getFriends, getPendingRequests, acceptFriendRequest, rejectFriendRequest, removeFriend } from '../services/user';
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
                getPendingRequests()
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
            removeFriend(friendId).then(() => loadFriends()).catch(err => Alert.alert('Error', err.message));
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
        console.log('Logout button pressed');
        if (Platform.OS === 'web') {
            const confirmed = window.confirm('Are you sure you want to log out?');
            if (confirmed) signOut();
        } else {
            Alert.alert('Logout', 'Are you sure you want to log out?', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Logout', onPress: () => {
                    console.log('User confirmed logout');
                    signOut();
                }},
            ]);
        }
    };

    const renderItem = ({ item }) => (
        <View style={styles.chatCardContainer}>
            <TouchableOpacity 
                style={styles.chatCard}
                onPress={() => navigation.navigate('ChatRoom', { 
                    recipientId: item._id, 
                    recipientName: item.username 
                })}
            >
                <Image source={{ uri: item.avatar }} style={styles.avatar} />
                <View style={styles.chatInfo}>
                    <Text style={styles.userName}>{item.username}</Text>
                    <Text style={styles.lastMsg}>Tap to start chatting...</Text>
                </View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.removeBtn} onPress={() => handleRemoveFriend(item._id, item.username)}>
                <Text style={styles.removeBtnText}>×</Text>
            </TouchableOpacity>
        </View>
    );

    const renderPendingItem = ({ item }) => (
        <View style={styles.pendingCard}>
            <View style={styles.pendingInfo}>
                <Text style={styles.pendingName}>{item.sender.username}</Text>
                <Text style={styles.pendingSub}>wants to be friends</Text>
            </View>
            <View style={styles.pendingActions}>
                <TouchableOpacity style={styles.acceptBtn} onPress={() => handleAccept(item._id)}>
                    <Text style={styles.actionText}>Accept</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.rejectBtn} onPress={() => handleReject(item._id)}>
                    <Text style={styles.actionText}>Reject</Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Messages</Text>
                <View style={styles.headerBtns}>
                    <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('Search')}>
                        <Text style={styles.iconText}>🔍</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.iconBtn} onPress={handleLogout}>
                        <Text style={styles.iconText}>🚪</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <FlatList
                data={friends}
                renderItem={renderItem}
                keyExtractor={(item) => item._id}
                ListHeaderComponent={
                    pendingRequests.length > 0 && (
                        <View style={styles.pendingSection}>
                            <Text style={styles.sectionTitle}>Friend Requests ({pendingRequests.length})</Text>
                            {pendingRequests.map(item => (
                                <View key={item._id}>{renderPendingItem({ item })}</View>
                            ))}
                            <View style={styles.divider} />
                            <Text style={styles.sectionTitle}>Friends</Text>
                        </View>
                    )
                }
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={loadFriends} tintColor="#00e0ff" />
                }
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyText}>No friends yet!</Text>
                        <TouchableOpacity 
                            style={styles.findBtn}
                            onPress={() => navigation.navigate('Search')}
                        >
                            <Text style={styles.findBtnText}>Find Friends</Text>
                        </TouchableOpacity>
                    </View>
                }
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#05060f', paddingHorizontal: 20, paddingTop: 50 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30 },
    title: { color: '#00e0ff', fontSize: 28, fontWeight: 'bold' },
    headerBtns: { flexDirection: 'row' },
    iconBtn: { marginLeft: 20, padding: 5 },
    iconText: { fontSize: 22 },
    chatCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.03)', padding: 15, borderRadius: 16, marginBottom: 12 },
    avatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#1a1b2e' },
    chatInfo: { flex: 1, marginLeft: 15 },
    userName: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
    lastMsg: { color: '#8b9cc8', fontSize: 13, marginTop: 2 },
    time: { color: '#00e0ff', fontSize: 12 },
    emptyContainer: { alignItems: 'center', marginTop: 100 },
    emptyText: { color: '#8b9cc8', fontSize: 16, marginBottom: 20 },
    findBtn: { backgroundColor: '#00e0ff', paddingVertical: 12, paddingHorizontal: 25, borderRadius: 12 },
    findBtnText: { color: '#fff', fontWeight: 'bold' },
    chatCardContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    chatCard: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.03)', padding: 15, borderRadius: 16 },
    removeBtn: { padding: 10, marginLeft: 5 },
    removeBtnText: { color: '#ff4b4b', fontSize: 24, fontWeight: 'bold' },
    pendingSection: { marginBottom: 20 },
    sectionTitle: { color: '#8b9cc8', fontSize: 14, fontWeight: 'bold', marginBottom: 10, textTransform: 'uppercase' },
    divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.05)', marginVertical: 15 },
    pendingCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(0,224,255,0.05)', padding: 12, borderRadius: 12, marginBottom: 8 },
    pendingInfo: { flex: 1 },
    pendingName: { color: '#fff', fontWeight: 'bold' },
    pendingSub: { color: '#8b9cc8', fontSize: 12 },
    pendingActions: { flexDirection: 'row' },
    acceptBtn: { backgroundColor: '#00e0ff', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6, marginRight: 8 },
    rejectBtn: { backgroundColor: 'rgba(255,75,75,0.2)', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6 },
    actionText: { color: '#fff', fontSize: 12, fontWeight: 'bold' }
});
