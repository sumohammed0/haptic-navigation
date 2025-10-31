# Minimum Viable Product (MVP) Specification
## Enhancing Mobility for Visually Impaired Users

### Executive Summary
This MVP defines the core requirements for a mobile application that facilitates research comparing three feedback modalities (audio, static haptic, and dynamic haptic) for visually impaired navigation and spatial learning.

---

## 1. Core Objectives

### Primary Goals
- Enable researchers to conduct standardized navigation experiments
- Compare effectiveness of three feedback modalities: Audio, Static Haptic, and Dynamic Haptic
- Measure spatial learning and object localization capabilities
- Collect quantitative and qualitative data for analysis

### Success Metrics
- Completion time per task
- Navigation errors count
- Object discovery success rate
- User satisfaction scores
- Spatial confidence ratings

---

## 2. MVP Feature Set

### 2.1 Essential Features (Must-Have)

#### User Management
- **Participant Registration**: Unique ID assignment, demographic collection
- **Session Management**: Track multiple sessions per participant
- **Condition Assignment**: Randomize or manually assign feedback mode order

#### Navigation Task (Stage 1: Red Dot Task)
- **Checkpoint System**: 5 predefined checkpoints throughout test environment
- **Real-time Guidance**: Deliver feedback based on selected modality
  - **Audio Mode**: Text-to-speech directional instructions ("Move forward 3 steps", "Turn right")
  - **Static Haptic**: Constant vibration patterns when approaching checkpoints
  - **Dynamic Haptic**: Variable vibration intensity/frequency based on distance to target
- **Progress Tracking**: Visual indicator for researchers showing current checkpoint
- **Error Detection**: Log when participant deviates from optimal path
- **Timer**: Automatic task duration recording

#### Break Management
- **5-Minute Timer**: Countdown timer for mandatory break between stages
- **Environmental Reset**: Ensure participant leaves and re-enters space
- **Automatic Transition**: Notify researcher when break period ends

#### Object Localization Task (Stage 2)
- **Hidden Object Placement**: Researcher interface to mark object location
- **Search Area Tracking**: Log participant's search pattern
- **Success Detection**: Record when object is found (or time limit expires)
- **Search Timer**: Track total search duration
- **No Guidance Mode**: All feedback disabled during this stage

#### Data Collection
- **Automatic Metrics**: 
  - Task completion time
  - Number of navigation errors
  - Object found (yes/no)
  - Search duration
- **Post-Task Survey**:
  - Ease of use (1-5 scale)
  - Clarity of guidance (1-5 scale)
  - Spatial confidence (1-5 scale)
  - Open-ended feedback text field

#### Data Export
- **CSV Export**: All session data for statistical analysis
- **Summary Reports**: Per-participant and per-condition aggregates

---

### 2.2 Hardware Requirements

#### Minimum System
- **Smartphone**: iOS 14+ or Android 10+
- **Vibration Motor**: Standard phone haptic engine (for haptic conditions)
- **Audio Output**: Built-in speaker or Bluetooth headphones
- **Sensors**: GPS/indoor positioning (optional for future versions)

#### Recommended Setup
- **Wearable Device**: Smartwatch with haptic feedback for dynamic haptic condition
- **Bluetooth Speakers**: For audio condition in open spaces
- **Tablet**: For researcher control interface (larger screen)

---

## 3. User Workflows

### 3.1 Researcher Workflow

```
1. Setup
   ↓
2. Create New Session (Participant ID, Feedback Mode)
   ↓
3. Brief Participant & Obtain Consent
   ↓
4. Start Red Dot Navigation Task
   ↓
5. Monitor Progress (view checkpoint completion)
   ↓
6. End Task (participant completes or gives up)
   ↓
7. Initiate 5-Minute Break
   ↓
8. Prepare Object Localization Task
   ↓
9. Start Search Task
   ↓
10. End Search (object found or time limit)
   ↓
11. Administer Post-Task Survey
   ↓
12. Save Session Data
   ↓
13. Repeat for remaining conditions
```

### 3.2 Participant Workflow

```
1. Registration (one-time)
   ↓
2. Pre-Task Briefing
   ↓
3. Red Dot Navigation (with selected feedback mode)
   ↓
4. 5-Minute Break (outside test environment)
   ↓
5. Return to Final Position
   ↓
6. Object Localization (no guidance)
   ↓
7. Post-Task Survey
   ↓
8. Debrief
   ↓
9. Repeat for 2 additional feedback conditions
```

---

## 4. Technical Architecture

### 4.1 App Components

#### Frontend (Mobile App)
- **Framework**: React Native (cross-platform iOS/Android)
- **UI Library**: React Native Paper (accessibility-focused)
- **Navigation**: React Navigation
- **State Management**: React Context API

#### Feedback System
- **Audio Module**:
  - Text-to-Speech API (iOS: AVSpeechSynthesizer, Android: TextToSpeech)
  - Pre-recorded audio files for critical instructions
- **Haptic Module**:
  - Vibration API (Expo Haptics or React Native Haptics)
  - Pattern generation for static/dynamic modes
- **Positioning Module** (Future):
  - Indoor positioning system (Bluetooth beacons, WiFi triangulation)
  - Distance calculation algorithms

#### Data Layer
- **Local Storage**: SQLite or AsyncStorage for session data
- **Cloud Sync** (Optional): Firebase Realtime Database for multi-device access

---

## 5. Core Algorithms

### 5.1 Dynamic Haptic Feedback Algorithm

```
Input: User position, Target checkpoint position
Output: Vibration pattern

1. Calculate distance = euclidean_distance(user_pos, target_pos)
2. Calculate direction_angle = angle_between(user_direction, target_direction)

3. Determine vibration intensity:
   - If distance < 1m: intensity = 100% (continuous)
   - Else if distance < 3m: intensity = 70%
   - Else if distance < 5m: intensity = 40%
   - Else: intensity = 20%

4. Determine vibration pattern:
   - If direction_angle < 15°: single pulse (straight ahead)
   - Else if direction_angle < 45°: double pulse (slight turn)
   - Else: triple pulse (sharp turn required)

5. Adjust frequency based on proximity:
   - frequency = base_frequency * (max_distance - distance) / max_distance
```

### 5.2 Navigation Error Detection

```
Input: User path history, Optimal path
Output: Error count

1. Define error threshold = 2 meters deviation
2. For each user position in path:
   - Calculate perpendicular distance to nearest optimal path segment
   - If distance > threshold:
     - Increment error_count
     - Record error location and timestamp
3. Return total error_count
```

---

## 6. Data Schema

### Participant Table
```
{
  participant_id: string (UUID),
  age: number,
  gender: string,
  vision_status: string (blind, low_vision, sighted_control),
  mobility_aid: string (cane, guide_dog, none),
  created_at: timestamp
}
```

### Session Table
```
{
  session_id: string (UUID),
  participant_id: string (foreign key),
  feedback_mode: string (audio, static_haptic, dynamic_haptic),
  stage: string (red_dot, object_search),
  start_time: timestamp,
  end_time: timestamp,
  completion_status: string (completed, incomplete),
  completion_time_seconds: number,
  navigation_errors: number,
  object_found: boolean,
  search_duration_seconds: number,
  created_at: timestamp
}
```

### Survey Response Table
```
{
  response_id: string (UUID),
  session_id: string (foreign key),
  ease_of_use: number (1-5),
  clarity_of_guidance: number (1-5),
  spatial_confidence: number (1-5),
  feedback_text: string,
  created_at: timestamp
}
```

### Checkpoint Log Table
```
{
  log_id: string (UUID),
  session_id: string (foreign key),
  checkpoint_id: number,
  reached_at: timestamp,
  time_since_start: number (seconds)
}
```

---

## 7. User Interface Mockups

### 7.1 Researcher Dashboard
```
+------------------------------------------+
|  Navigation Study Control Panel          |
+------------------------------------------+
| Participant: [Dropdown: P001, P002...]   |
| Feedback Mode: [Audio] [Static] [Dynamic]|
| Current Stage: Red Dot Navigation        |
+------------------------------------------+
| Checkpoint Progress:  ●●●○○  (3/5)      |
| Elapsed Time: 03:42                      |
| Navigation Errors: 2                     |
+------------------------------------------+
| [Start Task]  [End Task]  [Emergency Stop]|
+------------------------------------------+
| Recent Activity:                          |
| - Checkpoint 3 reached (03:15)           |
| - Error detected (02:47)                 |
| - Checkpoint 2 reached (01:28)           |
+------------------------------------------+
```

### 7.2 Participant Interface (Audio Mode)
```
+------------------------------------------+
|           Navigation Task                |
+------------------------------------------+
|                                          |
|         [Large Speaker Icon]             |
|                                          |
|    Current Instruction:                  |
|    "Turn right and move forward          |
|     toward the kitchen"                  |
|                                          |
+------------------------------------------+
| [Repeat Instruction]  [Request Help]     |
+------------------------------------------+
```

### 7.3 Post-Task Survey
```
+------------------------------------------+
|          Post-Task Survey                |
+------------------------------------------+
| How easy was it to use this guidance?    |
| ○ 1  ○ 2  ○ 3  ○ 4  ○ 5                |
|                                          |
| How clear were the directions?           |
| ○ 1  ○ 2  ○ 3  ○ 4  ○ 5                |
|                                          |
| How confident do you feel about the      |
| space layout?                            |
| ○ 1  ○ 2  ○ 3  ○ 4  ○ 5                |
|                                          |
| Additional Comments:                     |
| [Text area]                              |
|                                          |
+------------------------------------------+
|              [Submit Survey]             |
+------------------------------------------+
```

---

## 8. Accessibility Requirements

### Screen Reader Compatibility
- All UI elements must have semantic labels
- Navigation flow must be logical for TalkBack/VoiceOver
- High contrast mode support

### Alternative Input Methods
- Large touch targets (minimum 44x44 pixels)
- Voice commands for critical actions
- Hardware button shortcuts

### Audio Design
- Clear, natural-sounding speech synthesis
- Adjustable speech rate and volume
- Non-verbal audio cues (earcons) for confirmation

### Haptic Design
- Distinct patterns for different message types
- Adjustable intensity levels
- Multiple vibration motors if available (directional feedback)

---

## 9. Implementation Phases

### Phase 1: Core Infrastructure (Weeks 1-2)
- [ ] Project setup and architecture
- [ ] Basic UI framework
- [ ] Participant and session management
- [ ] Data storage implementation

### Phase 2: Red Dot Navigation (Weeks 3-4)
- [ ] Checkpoint system
- [ ] Audio feedback implementation
- [ ] Static haptic feedback
- [ ] Timer and error tracking

### Phase 3: Dynamic Haptic (Week 5)
- [ ] Distance calculation algorithms
- [ ] Dynamic vibration pattern generation
- [ ] Real-time feedback adjustment

### Phase 4: Object Localization (Week 6)
- [ ] Break timer functionality
- [ ] Search area tracking
- [ ] Object discovery detection

### Phase 5: Data & Testing (Weeks 7-8)
- [ ] Survey implementation
- [ ] Data export functionality
- [ ] Pilot testing with 3-5 participants
- [ ] Bug fixes and refinements

---

## 10. Testing Plan

### Unit Testing
- Feedback algorithm accuracy
- Timer precision
- Data storage/retrieval

### Usability Testing
- Researcher ease of use (setup, monitoring, data export)
- Participant interface clarity
- Survey comprehension

### Pilot Study
- **Participants**: 5 sighted individuals (blindfolded)
- **Protocol**: Full 3-condition protocol
- **Metrics**: Same as main study
- **Goal**: Identify technical issues, refine procedures

---

## 11. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Haptic feedback too subtle | High | Allow intensity adjustment, test with multiple devices |
| Indoor positioning inaccurate | Medium | Use manual checkpoint confirmation as backup |
| Participant fatigue | Medium | Keep tasks brief (<10 min each), allow breaks |
| Data loss | High | Implement auto-save, cloud backup |
| Accessibility barriers | High | Test with actual visually impaired users early |

---

## 12. Success Criteria

### Technical Success
- [ ] App runs on iOS and Android without crashes
- [ ] All three feedback modes function correctly
- [ ] Data is accurately recorded and exportable
- [ ] Pilot study completes with 5 participants

### Research Success
- [ ] Clear differentiation in completion times across conditions
- [ ] Measurable spatial learning (object localization performance)
- [ ] Positive user feedback (avg. ease of use > 3.5/5)
- [ ] Sufficient data quality for statistical analysis

---

## 13. Future Enhancements (Post-MVP)

### Version 2.0 Features
- Real-time indoor positioning (Bluetooth beacons)
- Heat map visualization of user paths
- Multi-language support
- Integration with existing assistive technologies
- Customizable checkpoint layouts
- Video recording for qualitative analysis
- Machine learning for adaptive feedback

### Research Extensions
- Outdoor navigation scenarios
- Complex multi-floor environments
- Collaboration with guide dogs/canes
- Long-term spatial memory retention studies

---

## 14. Budget Estimate

### Development (8 weeks)
- Mobile developer (full-time): $12,000 - $16,000
- UX/Accessibility consultant: $2,000 - $3,000
- Testing devices (3 phones, 1 smartwatch): $2,000

### Research Costs
- Participant compensation (15 participants × $50): $750
- Testing space rental: $500
- Miscellaneous supplies: $250

**Total MVP Budget**: $17,500 - $22,500

---

## 15. Deliverables

### Software
1. Mobile application (iOS + Android)
2. Source code repository
3. Technical documentation

### Documentation
1. User manual (researcher guide)
2. Participant consent form template
3. IRB protocol materials
4. Data analysis guide

### Research Outputs
1. Pilot study dataset (CSV)
2. Preliminary findings report
3. Conference paper draft (based on methodology section)

---

## Conclusion

This MVP provides a robust foundation for conducting the navigation study outlined in your research paper. By focusing on core functionality—three feedback modalities, two-stage testing protocol, and comprehensive data collection—the app enables rigorous comparison of navigation aids while remaining simple enough to build in 8 weeks.

The modular design allows for future enhancements (e.g., real-time positioning, outdoor navigation) without requiring architectural changes. Most importantly, the accessibility-first approach ensures the tool genuinely serves visually impaired users and produces meaningful research outcomes.