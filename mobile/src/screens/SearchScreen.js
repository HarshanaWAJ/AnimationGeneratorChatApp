import React, { useState } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { searchUsers, sendFriendRequest, removeFriend } from '../services/user';

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
            handleSearch(); // Refresh status
        } catch (err) {
            Alert.alert('Error', err.message);
        }
    };

    const handleUnfriend = async (userId) => {
        try {
            await removeFriend(userId);
            Alert.alert('Success', 'User removed from friends');
            handleSearch(); // Refresh status
        } catch (err) {
            Alert.alert('Error', err.message);
        }
    };

    const renderAction = (item) => {
        if (item.status === 'friend') {
            return (
                <TouchableOpacity style={styles.unfriendButton} onPress={() => handleUnfriend(item._id)}>
                    <Text style={styles.buttonText}>Unfriend</Text>
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
                <TouchableOpacity style={styles.addButton} onPress={() => handleAddFriend(item._id)}>
                    <Text style={styles.buttonText}>Add</Text>
                </TouchableOpacity>
            );
        }
    };

    const renderItem = ({ item }) => (
        <View style={styles.userCard}>
            <View>
                <Text style={styles.userName}>{item.username}</Text>
                <Text style={styles.userEmail}>{item.email}</Text>
            </View>
            {renderAction(item)}
        </View>
    );

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Text style={styles.backButton}>←</Text>
                </TouchableOpacity>
                <Text style={styles.title}>Find Friends</Text>
            </View>

            <View style={styles.searchBar}>
                <TextInput
                    style={styles.input}
                    placeholder="Search by username or email..."
                    placeholderTextColor="#8b9cc8"
                    value={query}
                    onChangeText={setQuery}
                    onSubmitEditing={handleSearch}
                />
                <TouchableOpacity style={styles.searchBtn} onPress={handleSearch}>
                    <Text style={styles.searchBtnText}>Search</Text>
                </TouchableOpacity>
            </View>

            <FlatList
                data={results}
                renderItem={renderItem}
                keyExtractor={(item) => item._id}
                ListEmptyComponent={<Text style={styles.emptyText}>No users found</Text>}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#05060f', padding: 20, paddingTop: 50 },
    header: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
    backButton: { color: '#00e0ff', fontSize: 28, marginRight: 20 },
    title: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
    searchBar: { flexDirection: 'row', marginBottom: 20 },
    input: { flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 10, padding: 12, color: '#fff' },
    searchBtn: { backgroundColor: '#00e0ff', padding: 12, borderRadius: 10, marginLeft: 10 },
    searchBtnText: { color: '#fff', fontWeight: 'bold' },
    userCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', padding: 15, borderRadius: 12, marginBottom: 10 },
    userName: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
    userEmail: { color: '#8b9cc8', fontSize: 12 },
    addButton: { backgroundColor: '#00e0ff', paddingVertical: 8, paddingHorizontal: 15, borderRadius: 8 },
    unfriendButton: { backgroundColor: 'rgba(255,75,75,0.2)', paddingVertical: 8, paddingHorizontal: 15, borderRadius: 8, borderWidth: 1, borderColor: '#ff4b4b' },
    buttonText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
    pendingBadge: { backgroundColor: 'rgba(139,156,200,0.2)', paddingVertical: 8, paddingHorizontal: 15, borderRadius: 8 },
    pendingText: { color: '#8b9cc8', fontSize: 12, fontWeight: 'bold' },
    emptyText: { color: '#8b9cc8', textAlign: 'center', marginTop: 50 },
});
