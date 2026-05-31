import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { register } from '../services/auth';
import { moderateScale } from '../utils/responsive';

export default function RegisterScreen({ navigation }) {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [userType, setUserType] = useState('normal'); // 'normal' or 'disabled'
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!username || !email || !password)
      return Alert.alert('Error', 'Please fill all fields');
    setLoading(true);
    try {
      await register({ username, email, password, userType });
      Alert.alert('Success', 'Account created! Please sign in.', [
        { text: 'OK', onPress: () => navigation.navigate('Login') },
      ]);
    } catch (err) {
      Alert.alert('Registration Failed', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.logoArea}>
            <Text style={styles.title}>💬 Chat</Text>
            <Text style={styles.subtitle}>Join our community</Text>
          </View>

          <View style={styles.form}>
            <Text style={styles.label}>Username</Text>
            <TextInput
              style={styles.input}
              placeholder="Choose a username"
              placeholderTextColor="#4a5568"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              returnKeyType="next"
            />

            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="you@example.com"
              placeholderTextColor="#4a5568"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              returnKeyType="next"
            />

            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor="#4a5568"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              returnKeyType="done"
              onSubmitEditing={handleRegister}
            />

            <Text style={styles.label}>I am registering as a:</Text>
            <View style={styles.userTypeContainer}>
              <TouchableOpacity
                style={[
                  styles.userTypeCard,
                  userType === 'normal' && styles.userTypeCardActive,
                ]}
                onPress={() => setUserType('normal')}
              >
                <Text
                  style={[
                    styles.userTypeCardText,
                    userType === 'normal' && styles.userTypeCardTextActive,
                  ]}
                >
                  Normal Person
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.userTypeCard,
                  userType === 'disabled' && styles.userTypeCardActive,
                ]}
                onPress={() => setUserType('disabled')}
              >
                <Text
                  style={[
                    styles.userTypeCardText,
                    userType === 'disabled' && styles.userTypeCardTextActive,
                  ]}
                >
                  Disabled Person
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleRegister}
              disabled={loading}
              activeOpacity={0.8}
            >
              <Text style={styles.buttonText}>
                {loading ? 'Creating Account...' : 'Create Account'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.linkBtn}
              onPress={() => navigation.navigate('Login')}
            >
              <Text style={styles.linkText}>
                Already have an account?{' '}
                <Text style={styles.linkHighlight}>Sign In</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
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
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: moderateScale(28),
    paddingVertical: moderateScale(40),
  },
  logoArea: {
    alignItems: 'center',
    marginBottom: moderateScale(48),
  },
  title: {
    fontSize: moderateScale(36),
    fontWeight: '800',
    color: '#00e0ff',
    marginBottom: moderateScale(8),
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: moderateScale(15),
    color: '#8b9cc8',
    textAlign: 'center',
  },
  form: {
    width: '100%',
  },
  label: {
    color: '#8b9cc8',
    fontSize: moderateScale(13),
    fontWeight: '600',
    marginBottom: moderateScale(8),
    letterSpacing: 0.3,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: moderateScale(14),
    paddingHorizontal: moderateScale(16),
    paddingVertical: moderateScale(14),
    color: '#fff',
    fontSize: moderateScale(15),
    marginBottom: moderateScale(20),
  },
  userTypeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: moderateScale(20),
  },
  userTypeCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: moderateScale(14),
    paddingVertical: moderateScale(14),
    alignItems: 'center',
    marginHorizontal: moderateScale(4),
  },
  userTypeCardActive: {
    borderColor: '#00e0ff',
    backgroundColor: 'rgba(0, 224, 255, 0.1)',
  },
  userTypeCardText: {
    color: '#8b9cc8',
    fontSize: moderateScale(14),
    fontWeight: '600',
  },
  userTypeCardTextActive: {
    color: '#00e0ff',
  },
  button: {
    backgroundColor: '#00e0ff',
    borderRadius: moderateScale(14),
    paddingVertical: moderateScale(16),
    alignItems: 'center',
    marginTop: moderateScale(8),
    shadowColor: '#00e0ff',
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#05060f',
    fontWeight: '800',
    fontSize: moderateScale(16),
    letterSpacing: 0.3,
  },
  linkBtn: {
    marginTop: moderateScale(24),
    alignItems: 'center',
    paddingVertical: moderateScale(8),
  },
  linkText: {
    color: '#8b9cc8',
    fontSize: moderateScale(14),
  },
  linkHighlight: {
    color: '#00e0ff',
    fontWeight: '700',
  },
});
