import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  TextInput,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Feather from 'react-native-vector-icons/Feather';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL as ENV_API_BASE_URL } from '@env';
import HeaderBar from '../components/HeaderBar';
import MenuModal from '../components/MenuModal';
import BottomNavBar from '../components/BottomNavBar';
import menuItems, { handleMenuItemAction } from '../components/menuItems';
import { useAuth } from '../contexts/AuthContext';
import ModernAlert from '../components/ModernAlert';
import { format } from 'date-fns';

/**
 * NotesScreen Component
 * 
 * Displays notes for the logged-in member
 * Member can view, create, update, and delete their own notes
 * 
 * API Endpoints:
 * - GET /api/mobile/notes - Get all notes for member
 * - POST /api/mobile/notes - Create a new note
 * - PUT /api/mobile/notes/{id} - Update a note
 * - DELETE /api/mobile/notes/{id} - Delete a note
 * 
 * Features:
 * - List of notes with filters (type/category)
 * - Create new notes
 * - Edit existing notes
 * - Delete notes
 * - Filter by type (general, check-in, coaching, invoices, files, member-check-up, others)
 * - Pull-to-refresh
 */
export default function NotesScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { logout } = useAuth();
  const [notes, setNotes] = useState([]);
  const [filteredNotes, setFilteredNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [selectedFilter, setSelectedFilter] = useState('all'); // all, general, progress, nutrition, workout
  const [menuVisible, setMenuVisible] = useState(false);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState({
    title: '',
    message: '',
    type: 'info',
    buttons: [],
  });
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [selectedNote, setSelectedNote] = useState(null);
  const [noteText, setNoteText] = useState('');
  const [noteType, setNoteType] = useState('general');
  const [saving, setSaving] = useState(false);
  const [categoryDropdownVisible, setCategoryDropdownVisible] = useState(false);

  const API_BASE_URL = ENV_API_BASE_URL;

  const noteTypes = [
    { value: 'all', label: 'All', icon: 'list', lib: 'MaterialCommunityIcons' },
    { value: 'general', label: 'General', icon: 'file-document-outline', lib: 'MaterialCommunityIcons' },
    { value: 'check-in', label: 'Check-in', icon: 'login', lib: 'MaterialCommunityIcons' },
    { value: 'coaching', label: 'Coaching', icon: 'account-tie', lib: 'MaterialCommunityIcons' },
    { value: 'invoices', label: 'Invoices', icon: 'file-document', lib: 'MaterialCommunityIcons' },
    { value: 'files', label: 'Files', icon: 'folder', lib: 'MaterialCommunityIcons' },
    { value: 'member-check-up', label: 'Member Check-up', icon: 'clipboard-check', lib: 'MaterialCommunityIcons' },
    { value: 'others', label: 'Others', icon: 'dots-horizontal', lib: 'MaterialCommunityIcons' },
  ];

  // Load notes when screen is focused
  useFocusEffect(
    useCallback(() => {
      loadNotes();
    }, [])
  );

  // Filter notes when filters change
  useEffect(() => {
    filterNotes();
  }, [notes, selectedFilter]);

  const loadNotes = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const userToken = await AsyncStorage.getItem('userToken');
      if (!userToken) {
        throw new Error('No authentication token found');
      }

      let authHeader = userToken;
      if (!userToken.startsWith('Bearer ')) {
        authHeader = `Bearer ${userToken}`;
      }

      // Add filter parameter if not 'all'
      const filterParam = selectedFilter !== 'all' ? `?type=${selectedFilter}` : '';
      const response = await fetch(`${API_BASE_URL}/mobile/notes${filterParam}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': authHeader,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('Notes data:', data);

      if (data.success && data.data) {
        // Handle paginated response
        const notesData = data.data.data || data.data || [];
        setNotes(notesData);
      } else {
        setNotes([]);
      }
    } catch (err) {
      console.error('Error loading notes:', err);
      setError(err.message || 'Failed to load notes');
      if (!isRefresh) {
        setAlertConfig({
          title: 'Error',
          message: err.message || 'Failed to load notes',
          type: 'error',
          buttons: [
            {
              text: 'OK',
              onPress: () => {},
              style: 'primary',
            },
          ],
        });
        setAlertVisible(true);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const filterNotes = () => {
    if (selectedFilter === 'all') {
      setFilteredNotes(notes);
    } else {
      setFilteredNotes(notes.filter(note => note.type === selectedFilter || note.category?.toLowerCase() === selectedFilter));
    }
  };

  const handleCreateNote = () => {
    setNoteText('');
    setNoteType('general');
    setSelectedNote(null);
    setCategoryDropdownVisible(false);
    setCreateModalVisible(true);
  };

  const handleEditNote = (note) => {
    setSelectedNote(note);
    setNoteText(note.note || note.description || '');
    setNoteType(note.type || 'general');
    setCategoryDropdownVisible(false);
    setEditModalVisible(true);
  };

  const handleDeleteNote = (note) => {
    setAlertConfig({
      title: 'Delete Note',
      message: 'Are you sure you want to delete this note?',
      type: 'warning',
      buttons: [
        {
          text: 'Cancel',
          onPress: () => {},
          style: 'secondary',
        },
        {
          text: 'Delete',
          onPress: () => deleteNote(note.id),
          style: 'primary',
        },
      ],
    });
    setAlertVisible(true);
  };

  const saveNote = async () => {
    if (!noteText.trim()) {
      setAlertConfig({
        title: 'Validation Error',
        message: 'Please enter a note',
        type: 'error',
        buttons: [
          {
            text: 'OK',
            onPress: () => {},
            style: 'primary',
          },
        ],
      });
      setAlertVisible(true);
      return;
    }

    try {
      setSaving(true);
      const userToken = await AsyncStorage.getItem('userToken');
      if (!userToken) {
        throw new Error('No authentication token found');
      }

      let authHeader = userToken;
      if (!userToken.startsWith('Bearer ')) {
        authHeader = `Bearer ${userToken}`;
      }

      const url = selectedNote
        ? `${API_BASE_URL}/mobile/notes/${selectedNote.id}`
        : `${API_BASE_URL}/mobile/notes`;

      const method = selectedNote ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': authHeader,
        },
        body: JSON.stringify({
          note: noteText.trim(),
          type: noteType,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to save note');
      }

      const data = await response.json();

      if (data.success) {
        setCreateModalVisible(false);
        setEditModalVisible(false);
        setNoteText('');
        setSelectedNote(null);
        setCategoryDropdownVisible(false);
        loadNotes();
        setAlertConfig({
          title: 'Success',
          message: selectedNote ? 'Note updated successfully' : 'Note created successfully',
          type: 'success',
          buttons: [
            {
              text: 'OK',
              onPress: () => {},
              style: 'primary',
            },
          ],
        });
        setAlertVisible(true);
      }
    } catch (err) {
      console.error('Error saving note:', err);
      setAlertConfig({
        title: 'Error',
        message: err.message || 'Failed to save note',
        type: 'error',
        buttons: [
          {
            text: 'OK',
            onPress: () => {},
            style: 'primary',
          },
        ],
      });
      setAlertVisible(true);
    } finally {
      setSaving(false);
    }
  };

  const deleteNote = async (noteId) => {
    try {
      setLoading(true);
      const userToken = await AsyncStorage.getItem('userToken');
      if (!userToken) {
        throw new Error('No authentication token found');
      }

      let authHeader = userToken;
      if (!userToken.startsWith('Bearer ')) {
        authHeader = `Bearer ${userToken}`;
      }

      const response = await fetch(`${API_BASE_URL}/mobile/notes/${noteId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': authHeader,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete note');
      }

      const data = await response.json();

      if (data.success) {
        loadNotes();
        setAlertConfig({
          title: 'Success',
          message: 'Note deleted successfully',
          type: 'success',
          buttons: [
            {
              text: 'OK',
              onPress: () => {},
              style: 'primary',
            },
          ],
        });
        setAlertVisible(true);
      }
    } catch (err) {
      console.error('Error deleting note:', err);
      setAlertConfig({
        title: 'Error',
        message: err.message || 'Failed to delete note',
        type: 'error',
        buttons: [
          {
            text: 'OK',
            onPress: () => {},
            style: 'primary',
          },
        ],
      });
      setAlertVisible(true);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = () => {
    loadNotes(true);
  };

  const getTypeColor = (type) => {
    switch (type) {
      case 'general':
        return '#666';
      case 'check-in':
        return '#2196F3';
      case 'coaching':
        return '#9C27B0';
      case 'invoices':
        return '#FF9800';
      case 'files':
        return '#607D8B';
      case 'member-check-up':
        return '#4CAF50';
      case 'others':
        return '#795548';
      default:
        return '#666';
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'general':
        return 'document-text';
      case 'check-in':
        return 'login';
      case 'coaching':
        return 'account-tie';
      case 'invoices':
        return 'file-document';
      case 'files':
        return 'folder';
      case 'member-check-up':
        return 'clipboard-check';
      case 'others':
        return 'dots-horizontal';
      default:
        return 'document-text';
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return format(date, 'MMM d, yyyy h:mm a');
    } catch (e) {
      return dateString;
    }
  };

  const renderNoteItem = ({ item }) => {
    const typeColor = getTypeColor(item.type);
    const typeIcon = getTypeIcon(item.type);

    return (
      <TouchableOpacity
        style={styles.noteCard}
        onPress={() => handleEditNote(item)}
        activeOpacity={0.7}
      >
        <View style={styles.noteHeader}>
          <View style={styles.noteTypeContainer}>
      
            <Text style={[styles.noteType, { color: typeColor }]}>
              {item.type?.toUpperCase() || item.category?.toUpperCase() || 'GENERAL'}
            </Text>
          </View>
          {item.coach && (
            <View style={styles.coachBadge}>
              <Ionicons name="person" size={12} color="#666" />
              <Text style={styles.coachText}>
                {item.coach.first_name} {item.coach.last_name}
              </Text>
            </View>
          )}
        </View>

        <Text style={styles.noteText} numberOfLines={4}>
          {item.note || item.description || item.content}
        </Text>

        <View style={styles.noteFooter}>
          <Text style={styles.noteDate}>
            {formatDate(item.created_at)}
          </Text>
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => handleDeleteNote(item)}
          >
            <Ionicons name="trash-outline" size={18} color="#ff4444" />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <MaterialCommunityIcons name="note-text-outline" size={64} color="#ccc" />
      <Text style={styles.emptyText}>No notes found</Text>
      <Text style={styles.emptySubtext}>
        {selectedFilter !== 'all'
          ? 'Try adjusting your filter'
          : 'Create your first note to get started'}
      </Text>
    </View>
  );

  const handleLogoutRequest = (logoutFunction) => {
    setAlertConfig({
      title: 'Logout',
      message: 'Are you sure you want to logout?',
      type: 'warning',
      buttons: [
        {
          text: 'Cancel',
          onPress: () => {},
          style: 'secondary',
        },
        {
          text: 'Logout',
          onPress: () => logoutFunction(),
          style: 'primary',
        },
      ],
    });
    setAlertVisible(true);
  };

  const handleMenuItemPress = (item) => {
    setMenuVisible(false);
    handleMenuItemAction(item, navigation, logout, handleLogoutRequest);
  };

  const renderMenuIcon = (item, idx) => {
    let IconComponent = MaterialCommunityIcons;
    if (item.lib === 'Feather') IconComponent = require('react-native-vector-icons/Feather').default;
    if (item.lib === 'Ionicons') IconComponent = Ionicons;
    return (
      <View key={item.label} style={{ alignItems: 'center' }}>
        <IconComponent name={item.icon} size={32} color="#222" />
        <Text style={{ fontSize: 11, fontWeight: '600', marginTop: 5, color: '#000' }}>{item.label}</Text>
      </View>
    );
  };

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.container}>
        <HeaderBar onMenuPress={() => setMenuVisible(true)} />
        <View style={[styles.loadingContainer, { paddingTop: insets.top + 80 }]}>
          <ActivityIndicator size="large" color="#000" />
          <Text style={styles.loadingText}>Loading notes...</Text>
        </View>
        <MenuModal
          visible={menuVisible}
          onClose={() => setMenuVisible(false)}
          menuItems={menuItems}
          renderMenuIcon={renderMenuIcon}
          onMenuItemPress={handleMenuItemPress}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <HeaderBar onMenuPress={() => setMenuVisible(true)} />
      
      {error && !loading ? (
        <View style={[styles.errorContainer, { paddingTop: insets.top + 80 }]}>
          <Ionicons name="alert-circle-outline" size={48} color="#ff6b6b" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => loadNotes()}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {/* Filter Chips */}
          <View style={styles.filtersContainer}>
            <FlatList
              horizontal
              data={noteTypes}
              keyExtractor={(item) => item.value}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.filterChip,
                    selectedFilter === item.value && styles.filterChipActive,
                  ]}
                  onPress={() => {
                    setSelectedFilter(item.value);
                    loadNotes();
                  }}
                >
                  <MaterialCommunityIcons
                    name={item.icon}
                    size={16}
                    color={selectedFilter === item.value ? '#fff' : '#666'}
                  />
                  <Text
                    style={[
                      styles.filterChipText,
                      selectedFilter === item.value && styles.filterChipTextActive,
                    ]}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              )}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filtersContent}
            />
          </View>

          <FlatList
            data={filteredNotes}
            renderItem={renderNoteItem}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={[
              filteredNotes.length === 0 ? styles.emptyListContainer : styles.listContainer,
              { paddingTop: 8 }
            ]}
            ListEmptyComponent={renderEmptyState}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor="#000"
              />
            }
            showsVerticalScrollIndicator={false}
          />
        </>
      )}

      {/* Create Note Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={handleCreateNote}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      {/* Create/Edit Note Modal */}
      <Modal
        visible={createModalVisible || editModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setCreateModalVisible(false);
          setEditModalVisible(false);
        }}
      >
        <KeyboardAvoidingView
          style={styles.modalKeyboardAvoid}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalOverlay}>
            <TouchableOpacity
              style={styles.modalBackdrop}
              activeOpacity={1}
              onPress={Keyboard.dismiss}
            />
            <View style={[styles.modalContent, { paddingBottom: Math.max(insets.bottom, 16) }]}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {selectedNote ? 'Edit Note' : 'Create Note'}
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    Keyboard.dismiss();
                    setCreateModalVisible(false);
                    setEditModalVisible(false);
                    setNoteText('');
                    setSelectedNote(null);
                    setCategoryDropdownVisible(false);
                  }}
                >
                  <Ionicons name="close" size={24} color="#222" />
                </TouchableOpacity>
              </View>

              <ScrollView
                style={styles.modalScroll}
                contentContainerStyle={styles.modalBody}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                bounces={false}
              >
                <Text style={styles.inputLabel}>Category</Text>
                <TouchableOpacity
                  style={styles.dropdownButton}
                  onPress={() => setCategoryDropdownVisible(!categoryDropdownVisible)}
                  activeOpacity={0.7}
                >
                  <View style={styles.dropdownButtonContent}>
                    {(() => {
                      const selectedCategory = noteTypes.find(t => t.value === noteType);
                      let IconComponent = MaterialCommunityIcons;
                      if (selectedCategory?.lib === 'Ionicons') {
                        IconComponent = Ionicons;
                      } else if (selectedCategory?.lib === 'Feather') {
                        IconComponent = Feather;
                      }
                      return (
                        <>
                          {selectedCategory && (
                            <IconComponent
                              name={selectedCategory.icon}
                              size={20}
                              color="#222"
                              style={styles.dropdownIcon}
                            />
                          )}
                          <Text style={styles.dropdownButtonText}>
                            {selectedCategory?.label || 'Select Category'}
                          </Text>
                        </>
                      );
                    })()}
                  </View>
                  <Ionicons
                    name={categoryDropdownVisible ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color="#666"
                  />
                </TouchableOpacity>

                {categoryDropdownVisible && (
                  <View style={styles.dropdownList}>
                    {noteTypes.filter(t => t.value !== 'all').map((type) => {
                      let IconComponent = MaterialCommunityIcons;
                      if (type.lib === 'Ionicons') {
                        IconComponent = Ionicons;
                      } else if (type.lib === 'Feather') {
                        IconComponent = Feather;
                      }

                      return (
                        <TouchableOpacity
                          key={type.value}
                          style={[
                            styles.dropdownItem,
                            noteType === type.value && styles.dropdownItemActive,
                          ]}
                          onPress={() => {
                            setNoteType(type.value);
                            setCategoryDropdownVisible(false);
                          }}
                          activeOpacity={0.7}
                        >
                          <IconComponent
                            name={type.icon}
                            size={18}
                            color={noteType === type.value ? '#222' : '#666'}
                            style={styles.dropdownItemIcon}
                          />
                          <Text
                            style={[
                              styles.dropdownItemText,
                              noteType === type.value && styles.dropdownItemTextActive,
                            ]}
                          >
                            {type.label}
                          </Text>
                          {noteType === type.value && (
                            <Ionicons name="checkmark" size={18} color="#222" />
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}

                <Text style={styles.inputLabel}>Note</Text>
                <TextInput
                  style={styles.noteInput}
                  placeholder="Enter your note..."
                  placeholderTextColor="#999"
                  multiline
                  numberOfLines={6}
                  value={noteText}
                  onChangeText={setNoteText}
                  textAlignVertical="top"
                />
              </ScrollView>

              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => {
                    Keyboard.dismiss();
                    setCreateModalVisible(false);
                    setEditModalVisible(false);
                    setNoteText('');
                    setSelectedNote(null);
                    setCategoryDropdownVisible(false);
                  }}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveButton, saving && styles.saveButtonDisabled]}
                  onPress={saveNote}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.saveButtonText}>Save</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <MenuModal
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        menuItems={menuItems}
        renderMenuIcon={renderMenuIcon}
        onMenuItemPress={handleMenuItemPress}
      />
      <BottomNavBar navigation={navigation} />
      <ModernAlert
        visible={alertVisible}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        buttons={alertConfig.buttons}
        onClose={() => setAlertVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7f8f2',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#888',
    fontWeight: '500',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#ff6b6b',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#222',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  filtersContainer: {
    backgroundColor: '#fff',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  filtersContent: {
    paddingHorizontal: 16,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: '#000',
  },
  filterChipText: {
    fontSize: 13,
    color: '#666',
    fontWeight: '600',
    marginLeft: 6,
  },
  filterChipTextActive: {
    color: '#fff',
  },
  listContainer: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  emptyListContainer: {
    flex: 1,
  },
  noteCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  noteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  noteTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  noteType: {
    fontSize: 11,
    fontWeight: '700',
    marginLeft: 6,
    textTransform: 'uppercase',
  },
  coachBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  coachText: {
    fontSize: 11,
    color: '#666',
    marginLeft: 4,
    fontWeight: '500',
  },
  noteText: {
    fontSize: 14,
    color: '#222',
    lineHeight: 20,
    marginBottom: 12,
  },
  noteFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  noteDate: {
    fontSize: 12,
    color: '#888',
  },
  deleteButton: {
    padding: 4,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#222',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 100,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#222',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  modalKeyboardAvoid: {
    flex: 1,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    maxHeight: '92%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#222',
  },
  modalScroll: {
    maxHeight: 420,
  },
  modalBody: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#222',
    marginBottom: 8,
  },
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#fafafa',
    marginBottom: 20,
  },
  dropdownButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  dropdownIcon: {
    marginRight: 10,
  },
  dropdownButtonText: {
    fontSize: 14,
    color: '#222',
    fontWeight: '500',
  },
  dropdownList: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginTop: -16,
    marginBottom: 20,
    maxHeight: 300,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    zIndex: 1000,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  dropdownItemActive: {
    backgroundColor: '#f5f5f5',
  },
  dropdownItemIcon: {
    marginRight: 12,
  },
  dropdownItemText: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  dropdownItemTextActive: {
    color: '#222',
    fontWeight: '600',
  },
  noteInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: '#222',
    minHeight: 120,
    backgroundColor: '#fafafa',
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    marginTop: 20,
  },
  cancelButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginRight: 12,
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: '#222',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
});
