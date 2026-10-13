import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Image,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { getDisplaySetRows } from '../utils/workoutPlanUtils';
import { getActivityThumbnailUrl } from '../utils/thumbnailUtils';
import { updateWorkoutActivityPlanSets } from '../api/workouts';
import { emitWorkoutPlanUpdated } from '../utils/workoutPlanEvents';

const DEFAULT_REPS = 10;
const DEFAULT_WEIGHT = 0;
const DEFAULT_REST = 30;
const DEFAULT_TIME = 30;

function buildInitialSets(activity) {
  const rows = getDisplaySetRows(activity);
  if (rows.length > 0) {
    return rows.map((set) => ({
      reps: String(set?.reps ?? DEFAULT_REPS),
      weight: String(set?.weight ?? DEFAULT_WEIGHT),
      rest: String(set?.rest ?? DEFAULT_REST),
      time: String(set?.time ?? DEFAULT_TIME),
    }));
  }

  return [
    {
      reps: String(DEFAULT_REPS),
      weight: String(DEFAULT_WEIGHT),
      rest: String(DEFAULT_REST),
      time: String(DEFAULT_TIME),
    },
  ];
}

const ActivitySetEditorScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const { activity, onSave, workoutId: routeWorkoutId } = route.params || {};

  const activityName =
    activity?.exercise_name || activity?.name || 'Exercise';
  const level =
    activity?.level ||
    activity?.difficulty ||
    activity?.exercise?.level ||
    'Intermediate';
  const thumbnailUrl = getActivityThumbnailUrl(activity) || activity?.processedThumbnailUrl;

  const [mode, setMode] = useState(
    activity?.input_mode === 'time' ? 'time' : 'reps'
  );
  const [sets, setSets] = useState(() => buildInitialSets(activity));
  const [personalNote, setPersonalNote] = useState(
    activity?.personal_note || activity?.notes || activity?.note || ''
  );
  const [saving, setSaving] = useState(false);

  const updateSet = (index, field, value) => {
    setSets((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    );
  };

  const addSet = () => {
    setSets((prev) => {
      const last = prev[prev.length - 1];
      return [
        ...prev,
        {
          reps: String(last?.reps ?? DEFAULT_REPS),
          weight: String(last?.weight ?? DEFAULT_WEIGHT),
          rest: String(last?.rest ?? DEFAULT_REST),
          time: String(last?.time ?? DEFAULT_TIME),
        },
      ];
    });
  };

  const removeSet = (index) => {
    setSets((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, i) => i !== index);
    });
  };

  const toNum = (value, fallback = 0) => {
    const n = parseInt(String(value).replace(/[^\d.-]/g, ''), 10);
    return Number.isFinite(n) ? n : fallback;
  };

  const handleSave = async () => {
    if (saving) return;

    const sets_configuration = sets.map((row) => {
      if (mode === 'time') {
        return {
          time: toNum(row.time, DEFAULT_TIME),
          rest: toNum(row.rest, DEFAULT_REST),
          weight: toNum(row.weight, DEFAULT_WEIGHT),
        };
      }
      return {
        reps: toNum(row.reps, DEFAULT_REPS),
        weight: toNum(row.weight, DEFAULT_WEIGHT),
        rest: toNum(row.rest, DEFAULT_REST),
      };
    });

    const first = sets_configuration[0] || {};
    const planRowId =
      activity?.workout_activity_plan_id ||
      activity?.activity_plan_id ||
      activity?.id;
    const workoutId = activity?.workout_id || routeWorkoutId || null;

    console.log('[ActivitySetEditor] SAVE start', {
      planRowId,
      workoutId,
      routeWorkoutId,
      activityId: activity?.id,
      workout_activity_plan_id: activity?.workout_activity_plan_id,
      exerciseId: activity?.exercise_id,
      plan_id: activity?.plan_id,
      activityKeys: activity ? Object.keys(activity) : [],
      setsCount: sets_configuration.length,
      sets_configuration,
      mode,
    });

    if (!planRowId) {
      console.log('[ActivitySetEditor] SAVE blocked — missing planRowId', activity);
      Alert.alert('Cannot save', 'Missing activity plan id. Please reopen the workout and try again.');
      return;
    }

    setSaving(true);
    try {
      const saved = await updateWorkoutActivityPlanSets(planRowId, {
        sets_configuration,
        personal_note: personalNote.trim(),
        input_mode: mode,
        workout_id: workoutId,
      });

      console.log('[ActivitySetEditor] SAVE success', saved);

      const updatedActivity = {
        ...activity,
        ...saved,
        sets: saved?.sets ?? sets_configuration.length,
        reps: saved?.reps ?? first.reps ?? activity?.reps ?? DEFAULT_REPS,
        weight: saved?.weight ?? first.weight ?? activity?.weight ?? DEFAULT_WEIGHT,
        rest_seconds:
          saved?.rest_seconds ?? first.rest ?? activity?.rest_seconds ?? DEFAULT_REST,
        rest: saved?.rest_seconds ?? first.rest ?? activity?.rest ?? DEFAULT_REST,
        sets_configuration: saved?.sets_configuration || sets_configuration,
        plan_sets_configuration: saved?.sets_configuration || sets_configuration,
        personal_note: saved?.personal_note ?? personalNote.trim(),
        notes: saved?.personal_note ?? personalNote.trim(),
        input_mode: saved?.input_mode || mode,
        workout_activity_plan_id: saved?.id || planRowId,
        id: saved?.id || planRowId,
      };

      emitWorkoutPlanUpdated({
        planId: planRowId,
        workoutId: updatedActivity.workout_id || workoutId,
        activity: updatedActivity,
      });

      if (typeof onSave === 'function') {
        onSave(updatedActivity);
      }

      navigation.goBack();
    } catch (error) {
      console.log('[ActivitySetEditor] SAVE ERROR', {
        message: error?.message,
        status: error?.status,
        response: error?.response,
        stack: error?.stack,
      });
      Alert.alert('Save failed', error?.message || 'Could not save sets to server.');
    } finally {
      setSaving(false);
    }
  };

  const headerTitle = useMemo(() => 'Editor', []);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.headerBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="close" size={26} color="#222" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{headerTitle}</Text>
        <TouchableOpacity
          onPress={handleSave}
          style={styles.headerBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#222" />
          ) : (
            <Text style={styles.saveText}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.activityHeader}>
            {thumbnailUrl ? (
              <Image source={{ uri: thumbnailUrl }} style={styles.thumb} />
            ) : (
              <View style={[styles.thumb, styles.thumbPlaceholder]}>
                <MaterialCommunityIcons name="dumbbell" size={22} color="#bbb" />
              </View>
            )}
            <View style={styles.activityMeta}>
              <Text style={styles.activityName} numberOfLines={2}>
                {activityName}
              </Text>
              <Text style={styles.activityLevel}>{String(level)}</Text>
            </View>
          </View>

          <View style={styles.modeToggle}>
            <TouchableOpacity
              style={[styles.modeTab, mode === 'reps' && styles.modeTabActive]}
              onPress={() => setMode('reps')}
              activeOpacity={0.8}
            >
              <Text style={[styles.modeTabText, mode === 'reps' && styles.modeTabTextActive]}>
                Reps
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeTab, mode === 'time' && styles.modeTabActive]}
              onPress={() => setMode('time')}
              activeOpacity={0.8}
            >
              <Text style={[styles.modeTabText, mode === 'time' && styles.modeTabTextActive]}>
                Time
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.columnHeaders}>
            <View style={styles.setIndexSpacer} />
            <Text style={styles.columnHeader}>
              {mode === 'reps' ? 'REPS' : 'TIME'}
            </Text>
            <Text style={styles.columnX}> </Text>
            <Text style={styles.columnHeader}>WEIGHT</Text>
            <View style={styles.deleteSpacer} />
          </View>

          {sets.map((row, index) => (
            <View key={`set-row-${index}`} style={styles.setBlock}>
              <View style={styles.setRow}>
                <Text style={styles.setIndex}>{index + 1}</Text>

                <TextInput
                  style={styles.inputBox}
                  value={mode === 'reps' ? row.reps : row.time}
                  onChangeText={(v) =>
                    updateSet(index, mode === 'reps' ? 'reps' : 'time', v.replace(/[^\d]/g, ''))
                  }
                  keyboardType="number-pad"
                  placeholder={mode === 'reps' ? '10' : '30'}
                  placeholderTextColor="#666"
                  maxLength={4}
                />

                <Text style={styles.timesX}>x</Text>

                <View style={styles.weightBox}>
                  <TextInput
                    style={styles.weightInput}
                    value={row.weight}
                    onChangeText={(v) => updateSet(index, 'weight', v.replace(/[^\d.]/g, ''))}
                    keyboardType="decimal-pad"
                    placeholder="0"
                    placeholderTextColor="#666"
                    maxLength={6}
                  />
                  <Text style={styles.weightUnit}>lbs</Text>
                </View>

                <TouchableOpacity
                  style={styles.deleteBtn}
                  onPress={() => removeSet(index)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  disabled={sets.length <= 1}
                >
                  <Ionicons
                    name="close-circle"
                    size={22}
                    color={sets.length <= 1 ? '#ddd' : '#999'}
                  />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.restBar}
                activeOpacity={0.8}
                onPress={() => {
                  // Cycle common rest values for quick edit
                  const current = toNum(row.rest, DEFAULT_REST);
                  const options = [15, 30, 45, 60, 90, 120];
                  const next = options[(options.indexOf(current) + 1) % options.length] || 30;
                  updateSet(index, 'rest', String(next));
                }}
              >
                <Ionicons name="timer-outline" size={16} color="#666" />
                <TextInput
                  style={styles.restInput}
                  value={row.rest}
                  onChangeText={(v) => updateSet(index, 'rest', v.replace(/[^\d]/g, ''))}
                  keyboardType="number-pad"
                  placeholder="30"
                  placeholderTextColor="#aaa"
                  maxLength={4}
                />
                <Text style={styles.restSuffix}>s rest</Text>
              </TouchableOpacity>
            </View>
          ))}

          <TouchableOpacity style={styles.addSetBtn} onPress={addSet} activeOpacity={0.8}>
            <Ionicons name="add" size={20} color="#222" />
            <Text style={styles.addSetText}>Add set</Text>
          </TouchableOpacity>

          <Text style={styles.noteLabel}>Personal note</Text>
          <TextInput
            style={styles.noteInput}
            value={personalNote}
            onChangeText={setPersonalNote}
            placeholder="Add a note..."
            placeholderTextColor="#aaa"
            multiline
            textAlignVertical="top"
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7f7f7',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 12,
    minHeight: 48,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e5e5',
  },
  headerBtn: {
    minWidth: 56,
    paddingVertical: 8,
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    color: '#111',
    fontSize: 17,
    fontWeight: '700',
  },
  saveText: {
    color: '#222',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'right',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  activityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 12,
  },
  thumb: {
    width: 52,
    height: 52,
    borderRadius: 10,
    backgroundColor: '#eaeaea',
  },
  thumbPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  activityMeta: {
    flex: 1,
  },
  activityName: {
    color: '#111',
    fontSize: 18,
    fontWeight: '700',
  },
  activityLevel: {
    color: '#888',
    fontSize: 14,
    marginTop: 2,
  },
  modeToggle: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 4,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#ececec',
  },
  modeTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  modeTabActive: {
    backgroundColor: '#222',
  },
  modeTabText: {
    color: '#888',
    fontSize: 15,
    fontWeight: '600',
  },
  modeTabTextActive: {
    color: '#fff',
  },
  columnHeaders: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    paddingRight: 4,
  },
  setIndexSpacer: {
    width: 28,
  },
  columnHeader: {
    flex: 1,
    textAlign: 'center',
    color: '#888',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  columnX: {
    width: 20,
  },
  deleteSpacer: {
    width: 28,
  },
  setBlock: {
    marginBottom: 14,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  setIndex: {
    width: 28,
    color: '#222',
    fontSize: 16,
    fontWeight: '600',
  },
  inputBox: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    color: '#111',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    borderWidth: 1,
    borderColor: '#ececec',
  },
  timesX: {
    width: 20,
    textAlign: 'center',
    color: '#888',
    fontSize: 14,
    fontWeight: '600',
  },
  weightBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#ececec',
  },
  weightInput: {
    flex: 1,
    paddingVertical: 12,
    color: '#111',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  weightUnit: {
    color: '#888',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 2,
  },
  deleteBtn: {
    width: 28,
    alignItems: 'flex-end',
  },
  restBar: {
    marginTop: 8,
    marginLeft: 28,
    marginRight: 28,
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#ececec',
  },
  restInput: {
    color: '#222',
    fontSize: 14,
    fontWeight: '600',
    minWidth: 28,
    padding: 0,
  },
  restSuffix: {
    color: '#666',
    fontSize: 14,
    fontWeight: '500',
  },
  addSetBtn: {
    marginTop: 8,
    marginBottom: 28,
    borderWidth: 1.5,
    borderColor: '#222',
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#fff',
  },
  addSetText: {
    color: '#222',
    fontSize: 16,
    fontWeight: '700',
  },
  noteLabel: {
    color: '#111',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 10,
  },
  noteInput: {
    backgroundColor: '#fff',
    borderRadius: 12,
    minHeight: 100,
    padding: 14,
    color: '#222',
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#ececec',
  },
});

export default ActivitySetEditorScreen;
