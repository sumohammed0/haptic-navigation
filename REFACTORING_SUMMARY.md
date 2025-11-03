# Refactoring Summary

This document summarizes the comprehensive refactoring performed to implement indoor navigation features.

## Overview

The application has been refactored from a GPS-based outdoor navigation system to an indoor waypoint-based navigation system with step-by-step guidance, researcher-controlled operation, and hands-free user experience.

## Major Changes

### 1. State Management (AppContext)

**Added:**
- `NavigationWaypoint` type: Represents a single waypoint with direction instruction and optional heading
- `NavigationRoute` type: Collection of waypoints forming a navigation path
- `NavigationState` type: Active navigation session state
- Route management functions: `addRoute`, `updateRoute`, `deleteRoute`, `getRoute`
- Navigation control functions: `startNavigation`, `stopNavigation`, `advanceToNextWaypoint`, `markWaypointReached`, `getCurrentWaypoint`

**Modified:**
- Session type now includes `routeId` for tracking which route was used
- Settings structure maintained for backward compatibility (GPS coordinates deprecated but kept)

**Fixed:**
- UUID import issue (replaced `uuid.v4()` with `generateUuidV4()`)

### 2. Unified Navigation Engine

**Created:** `hooks/useIndoorNavigation.ts`

- Centralized navigation logic used by all feedback modes
- Monitors current waypoint and user heading
- Calculates alignment error automatically
- Provides automatic waypoint progression when user is aligned
- Returns comprehensive alignment data for feedback rendering

**Key Features:**
- Automatic waypoint advancement after 2 seconds of sustained alignment
- Handles cases where target heading is not specified (direction-based only)
- Efficient heading monitoring with permission handling
- Cleanup on unmount/unfocus

### 3. Calibration System

**Created:** `app/calibration.tsx`

- Researcher interface for creating indoor navigation routes
- Walk-to-point calibration: researcher walks to locations and logs waypoints
- Direction instruction input for each waypoint
- Optional heading capture for alignment-based feedback
- Route management (create, update, delete, load)
- Visual waypoint list with order display

### 4. Navigation Mode Refactoring

All three navigation modes completely refactored:

#### Audio Mode (`app/(tabs)/audio.tsx`)
- Removed GPS/latitude-longitude logic
- Uses `useIndoorNavigation` hook
- Provides step-by-step audio directions
- Announces waypoint instructions when waypoint changes
- Provides alignment feedback when target heading specified
- Hands-free operation (no user interaction)

#### Static Haptic Mode (`app/(tabs)/haptic.tsx`)
- Removed GPS/latitude-longitude logic
- Uses `useIndoorNavigation` hook
- Continuous vibration when aligned
- Vibration stops when not aligned
- Brief pulse on waypoint change
- Hands-free operation

#### Dynamic Haptic Mode (`app/(tabs)/haptic-dynamic.tsx`)
- Removed GPS/latitude-longitude logic
- Uses `useIndoorNavigation` hook
- Continuous vibration when perfectly aligned
- Direction-coded pulsing when not aligned (double/single pulse)
- Frequency and intensity vary with proximity
- Hands-free operation

### 5. Researcher Control Panel

**Refactored:** `app/(tabs)/researcher.tsx`

**Added:**
- Route selection interface
- Navigation mode selection with descriptions
- Integration with navigation start/stop
- Link to calibration screen
- Navigation status display
- Task-specific route filtering (future-ready)

**Workflow:**
1. Select/create route
2. Select feedback mode
3. Start task - navigation begins automatically
4. Monitor progress
5. Control navigation start/stop

### 6. Task Integration

#### Red Dot Task (`app/stages/red-dot.tsx`)
- Auto-starts timer when navigation begins
- Integrates with active navigation state
- Logs checkpoints and errors
- Displays navigation status
- Ends task and updates session data

#### Object Search Task (`app/stages/object-search.tsx`)
- Auto-starts timer when navigation begins
- Integrates with active navigation state
- Logs object found and placement status
- Tracks search duration
- Ends task and updates session data

### 7. App Layout

**Modified:** `app/_layout.tsx`
- Added calibration route to Stack navigator

## Architecture Improvements

### Modularity
- Separated navigation logic into reusable hook
- Clear separation between UI and navigation logic
- Consistent patterns across all navigation modes

### Maintainability
- Comprehensive TypeScript types
- Well-documented code with JSDoc comments
- Consistent code style and patterns
- Clear file organization

### User Experience
- Hands-free operation for blindfolded users
- Automatic waypoint progression
- Researcher has full control over navigation flow
- Clear status indicators

### Researcher Experience
- Intuitive calibration interface
- Easy route management
- Clear task control
- Real-time navigation status

## Removed/Deprecated

### GPS-Based Navigation
- Removed dependency on `targetLat` and `targetLon` for navigation
- Removed `bearingFromAToB` calculations
- Replaced with waypoint-based system

**Note:** Settings still maintain GPS coordinates for backward compatibility, but they are not used by the new navigation system.

## Data Flow

### Calibration Phase
1. Researcher opens Calibration screen
2. Creates route with name and task type
3. Walks to locations, logs waypoints with directions
4. Saves route

### Navigation Phase
1. Researcher selects route and feedback mode
2. Starts task from Researcher panel
3. `startNavigation()` called with routeId and mode
4. Navigation state updated
5. User routed to appropriate navigation screen
6. `useIndoorNavigation` hook monitors heading and waypoints
7. Feedback provided based on alignment
8. Waypoints advance automatically when aligned
9. Navigation completes when final waypoint reached

### Task Phase
1. Task screen auto-starts timer on navigation start
2. Researcher logs task events (checkpoints, errors, object found)
3. Task ends when complete
4. Session data updated and saved

## Testing Recommendations

1. **Calibration**: Test waypoint creation, editing, deletion
2. **Navigation Modes**: Verify all three modes work correctly with waypoints
3. **Waypoint Progression**: Test automatic advancement with different alignment scenarios
4. **Task Integration**: Verify timer starts/stops correctly with navigation
5. **State Management**: Test navigation start/stop, route switching
6. **Edge Cases**: Empty routes, no heading specified, rapid mode switching

## Known Limitations

1. Waypoint editing not yet implemented (must delete and recreate)
2. Route duplication not available
3. No visual navigation map for researchers
4. Heading-based alignment optional (direction-only navigation works)
5. No persistence of routes (in-memory only - consider AsyncStorage for production)

## Future Enhancements

- Route templates
- Waypoint editing UI
- Route duplication
- Enhanced analytics
- Route persistence
- Multiple route segments
- Integration with indoor positioning systems

## Migration Notes

For existing users:
- Old GPS-based navigation no longer functional
- Need to create routes via Calibration screen
- Settings for GPS coordinates preserved but unused
- Session data structure extended with `routeId`

## Code Quality

- ✅ All TypeScript types properly defined
- ✅ No linter errors
- ✅ Comprehensive documentation
- ✅ Consistent code style
- ✅ Proper cleanup and resource management
- ✅ Error handling for edge cases

