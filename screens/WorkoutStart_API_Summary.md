# WorkoutStart.js - API Calls Summary

## Total APIs: **4 Different Endpoints**

---

## 1. **GET** `/mobile/workout-activities/workout/{workoutId}`
**Function:** `fetchWorkoutActivities()`

**Purpose:**
- Fetches all workout activities organized by days
- Gets the complete list of exercises/activities for the workout
- Retrieves available days (Monday, Tuesday, etc.) for the workout
- Returns activities grouped by day

**When Called:**
- On initial page load (useEffect)
- When user pulls to refresh
- When user changes day selection
- When screen comes into focus (if needed)

**Response Structure:**
```json
{
  "success": true,
  "data": {
    "days": [
      {
        "day": "Monday",
        "activities": [...]
      }
    ]
  }
}
```

**What it does:**
- Sets `workoutActivities` state with activities for selected day
- Sets `availableDays` state with list of available days
- Triggers status fetch for all available days

---

## 2. **GET** `/mobile/member-workouts/{workoutId}/day/{dayNumber}/activities`
**Function:** `fetchWorkoutStatus(day)`

**Purpose:**
- Fetches the status of a specific day's activities
- Checks if a day is completed, in progress, or not started
- Gets day-specific session information
- Returns activities with their completion status

**When Called:**
- After fetching workout activities (for all available days)
- When user changes day selection
- On screen focus (with throttling to prevent duplicates)

**Response Structure:**
```json
{
  "success": true,
  "day_status": "in_progress" | "not_started" | "completed",
  "day_name": "Monday",
  "day_id": 35,
  "day_session": {...},
  "activities": [...]
}
```

**What it does:**
- Updates `dayStatusMap` state with status for specific day
- Shows completion checkmarks on day buttons
- Determines if "Finish training" or "Training summary" button should show

**Special Features:**
- Prevents duplicate calls (tracks pending requests)
- Throttles rapid calls (2 second minimum between calls)
- Only fetches for days that exist in availableDays

---

## 3. **POST** `/mobile/member-workouts/{workoutId}/day/{dayNumber}/complete`
**Function:** `completeWorkoutDay()`

**Purpose:**
- Marks a specific day as completed
- Updates the day status in the backend
- Records completion timestamp

**When Called:**
- When user clicks "Finish training" button
- Before navigating to workout summary screen

**What it does:**
- Sends POST request to mark day as complete
- Returns boolean (success/failure)
- Used to update day status after workout completion

---

## 4. **GET** `/mobile/member-workouts/{workoutId}/day/{dayNumber}/summary`
**Function:** `fetchWorkoutSummary()`

**Purpose:**
- Fetches workout summary statistics for a completed day
- Gets duration, calories burned, sets completed, etc.
- Retrieves detailed completion data

**When Called:**
- When user clicks "Training summary" button (if day is already completed)
- After completing a day (to show summary screen)

**Response Structure:**
```json
{
  "success": true,
  "summary": {
    "duration": 30,
    "calories": 200,
    "sets": 15,
    "activities": 5
  }
}
```

**What it does:**
- Provides data for WorkoutFinished screen
- Shows workout statistics and achievements
- Used for displaying completion summary

---

## API Call Flow

### Initial Load:
1. `fetchWorkoutActivities()` → Gets all activities and days
2. `fetchWorkoutStatus(day)` → Called for each available day (Monday, Tuesday, etc.)

### Day Selection:
1. `fetchWorkoutActivities()` → Refreshes activities for new day
2. `fetchWorkoutStatus(day)` → Gets status for selected day

### Complete Workout:
1. `completeWorkoutDay()` → Marks day as complete
2. `fetchWorkoutSummary()` → Gets summary data
3. Navigate to WorkoutFinished screen

---

## Performance Optimizations

1. **Duplicate Prevention:**
   - Tracks pending requests in `pendingStatusRequests` ref
   - Prevents multiple simultaneous calls for same day

2. **Throttling:**
   - Minimum 2 seconds between status fetches for same day
   - Prevents rapid-fire API calls

3. **Smart Fetching:**
   - Only fetches status for days that exist
   - Skips API call if activities already in workout object
   - Uses InteractionManager for smooth loading

4. **Error Handling:**
   - 404 errors handled gracefully (no activities = empty array)
   - Network errors show user-friendly messages
   - Failed requests don't break the UI

---

## Summary

- **4 API endpoints** total
- **2 GET endpoints** for fetching data (activities & status)
- **1 POST endpoint** for completing workout
- **1 GET endpoint** for summary data
- All APIs require authentication (Bearer token)
- All APIs are day-specific (work with day numbers 1-7)

