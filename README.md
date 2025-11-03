# Indoor Haptic Navigation System

A React Native application for indoor navigation studies with audio and haptic feedback. Designed for blindfolded users to navigate indoor spaces using step-by-step guidance through pre-calibrated waypoints.

## Features

### Navigation Modes

1. **Audio-only**: Step-by-step audio directions guide the user through waypoints
2. **Static Haptic**: Fixed vibration patterns indicate when user is aligned with target direction
3. **Dynamic Haptic**: Variable intensity/frequency vibration that increases as user approaches target direction

### Tasks

1. **Red Dot Task**: User locates red dots on walls while following navigation
2. **Object Search Task**: User finds a specific object and places it at a target location

### Key Features

- **Indoor Waypoint-Based Navigation**: Replace GPS coordinates with indoor calibration points
- **Step-by-Step Guidance**: Directions are delivered one after another automatically
- **Researcher-Controlled**: Researcher controls navigation modes and task execution
- **Hands-Free Operation**: Users require no interaction with the app (blindfolded operation)
- **Automatic Waypoint Progression**: System advances through waypoints automatically when user aligns

## Architecture

### Core Components

- **AppContext** (`context/AppContext.tsx`): Global state management for participants, sessions, routes, and navigation state
- **useIndoorNavigation Hook** (`hooks/useIndoorNavigation.ts`): Unified navigation logic for all feedback modes
- **Calibration Screen** (`app/calibration.tsx`): Researcher interface for creating navigation routes
- **Navigation Mode Screens**: Audio, Static Haptic, and Dynamic Haptic implementations
- **Task Screens**: Red Dot and Object Search task interfaces

### Data Structures

#### NavigationWaypoint
- `waypointId`: Unique identifier
- `order`: Sequential position in route (0-based)
- `direction`: Text instruction for user (e.g., "Turn left", "Go straight")
- `targetHeading`: Optional heading in degrees (0-360) for alignment feedback
- `createdAt`: Timestamp

#### NavigationRoute
- `routeId`: Unique identifier
- `routeName`: Descriptive name
- `waypoints`: Array of waypoints in order
- `taskType`: Optional association with task type
- `createdAt` / `updatedAt`: Timestamps

#### NavigationState
- `routeId`: Active route identifier
- `currentWaypointIndex`: Current waypoint (0-based)
- `isActive`: Whether navigation is active
- `feedbackMode`: Current feedback mode
- `reachedCurrentWaypoint`: Whether current waypoint is reached

## Usage Guide

### For Researchers

#### 1. Calibration Process

1. Navigate to **Calibration** screen from the Researcher control panel
2. Create a new route:
   - Enter a route name (e.g., "Red Dot Task Route A")
   - Optionally select task type
   - Press "Save Route"

3. Log waypoints:
   - Walk to the first key location in your navigation path
   - Press "Log Point"
   - Enter the direction instruction (e.g., "Go straight", "Turn left 90 degrees")
   - The system captures your current heading (optional)
   - Repeat for each key location in sequence

4. Review waypoints:
   - All logged waypoints appear in a list
   - You can delete waypoints if needed
   - Waypoints are automatically ordered sequentially

#### 2. Running a Task Session

1. **Create Session**:
   - Navigate to "New Session" from Researcher panel
   - Enter participant information
   - Select feedback mode (can be changed later)

2. **Start Navigation**:
   - Select a route from the route list
   - Select feedback mode (audio, static haptic, or dynamic haptic)
   - Press "Start Red Dot Task" or "Start Object Search Task"
   - Navigation begins automatically and user is routed to appropriate screen

3. **Monitor Progress**:
   - Navigation status shows current waypoint
   - Task screens show elapsed time and allow logging checkpoints/errors
   - User receives guidance automatically through selected mode

4. **Complete Task**:
   - Log task completion events (checkpoints, object found, etc.)
   - Press "End Task" when complete
   - Data is automatically saved to session

#### 3. After Each Task

- Researcher can select a different navigation mode
- Start the next task with new mode
- System maintains session data across tasks

### For Users (Blindfolded Operation)

Users interact with the app **only through audio/haptic feedback**:

- **Audio Mode**: Listen to spoken directions and alignment feedback
- **Static Haptic**: Feel continuous vibration when aligned correctly
- **Dynamic Haptic**: Feel pulsing patterns:
  - Double pulse = turn right
  - Single pulse = turn left
  - Faster/stronger pulses = closer to target

**No screen interaction required** - user holds phone and follows feedback.

## Navigation Logic

### Waypoint Progression

1. System provides guidance for current waypoint
2. If target heading is specified, system monitors user alignment
3. When user is aligned for sustained period (2 seconds), system advances to next waypoint
4. Process repeats until final waypoint is reached
5. Navigation completes automatically

### Alignment Calculation

- Target heading (if specified) compared to current user heading
- Alignment error calculated as angle difference (-180° to +180°)
- Positive error = turn right, negative = turn left
- User is "aligned" when absolute error ≤ threshold (default 15°)

### Feedback by Mode

#### Audio Mode
- Announces waypoint instruction when waypoint changes
- Provides alignment correction feedback periodically
- Confirms alignment when user is correctly oriented

#### Static Haptic Mode
- Continuous vibration pattern when aligned
- Vibration stops when user turns away
- Brief pulse when waypoint changes (if not already aligned)

#### Dynamic Haptic Mode
- Continuous vibration when perfectly aligned
- Direction-coded pulsing when not aligned:
  - Double pulse (right) vs single pulse (left)
  - Frequency: 200ms (close) to 1200ms (far)
  - Intensity: Heavy (0-10°), Medium (10-30°), Light (30-180°)

## Data Export

CSV export includes:
- Session ID, participant ID
- Feedback mode, task stage
- Start/end times, completion status
- Completion time, navigation errors
- Task-specific data (object found, search duration)
- Route ID used

## Technical Notes

### Dependencies

- `expo-location`: Heading and location services
- `expo-speech`: Audio feedback
- `expo-haptics`: Haptic feedback
- `react-native`: Core framework
- `expo-router`: Navigation

### Permissions

- Location permissions required for compass/heading data
- Permissions requested automatically on first use

### Performance Considerations

- Navigation checks alignment every 100-200ms (configurable)
- Speech synthesis throttled to prevent overlap
- Vibration patterns optimized for battery efficiency
- Heading updates use watchHeadingAsync for efficiency

## File Structure

```
app/
  (tabs)/
    researcher.tsx          # Researcher control panel
    audio.tsx               # Audio navigation mode
    haptic.tsx              # Static haptic navigation mode
    haptic-dynamic.tsx      # Dynamic haptic navigation mode
  calibration.tsx           # Route calibration interface
  stages/
    red-dot.tsx             # Red Dot task screen
    object-search.tsx       # Object Search task screen
  session/
    new.tsx                 # Session creation
context/
  AppContext.tsx            # Global state management
hooks/
  useIndoorNavigation.ts    # Unified navigation hook
```

## Future Enhancements

- Waypoint editing (modify existing waypoints)
- Route templates and duplication
- Real-time navigation visualization for researchers
- Enhanced error logging and analytics
- Support for multiple route segments
- Integration with external indoor positioning systems

## Troubleshooting

### Navigation not starting
- Ensure route has at least one waypoint
- Check that route is selected in Researcher panel
- Verify location permissions are granted

### Alignment not working
- Verify target heading was captured during calibration
- Check compass calibration (move phone in figure-8)
- Ensure alignment threshold is appropriate (default 15°)

### Feedback not responding
- Check device vibration/audio settings
- Verify navigation is active (check status in Researcher panel)
- Restart navigation if needed

## License

Private project for research purposes.

