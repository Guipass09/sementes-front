# Live Session Audio

The call has one per-session mixer. It is a volume mixer, not a clinical frequency
equalizer. No recording or server-side audio storage was added.

## Recommended Levels

| Channel | Initial level | Initially muted | Maximum |
| --- | --- | --- | --- |
| Professional microphone | 100% | No | 200% |
| Patient microphone | 100% | No | 200% |
| Activity media | 70% | No | 100% |
| Game effects | 35% | No | 100% |
| Reactions | 30% | No | 100% |
| Selected session music | 25% | No, but playback is paused | 100% |
| Game soundtrack | 20% | Yes | 100% |
| Shared screen audio | 70% | No | 100% |

Levels are reset on entry rather than read from browser preferences. Restoring
recommended settings also pauses selected music. Hardware volume, microphone
permission and the participant's own microphone switch remain authoritative.

## Signal Paths

- Microphones: authorized raw capture -> digital gain -> dynamics compressor ->
  MediaStreamAudioDestination -> WebRTC sender. Never monitor the local microphone
  through speakers. The patient's gain is applied at the patient's sending side,
  so the receiver does not amplify it a second time. Unsupported Web Audio falls
  back to raw capture and reports that gain control is unavailable.
- Activity audio/video: media element -> Web Audio gain -> speakers. Live videos
  request anonymous CORS; the API must continue returning the frontend's allowed
  origin. This avoids relying on writable `HTMLMediaElement.volume` on iOS.
- Game effects retain the existing effects bus, independent from activity media.
  During a live call every effect (including card clicks and completion music) is
  delegated to that device's top-level call window, whose audio is unlocked by
  the join gesture. Mirrored game events trigger the same feedback on the other
  participant, including explicit memory pair resolution. Sound requests never
  travel back over signaling, preventing feedback loops or doubled effects.
  The call validates origin, current iframe, content/share identity, effect names,
  freshness and duplicate IDs. Suspended audio offers an activation button and
  drops old effects instead of queueing them for later. All these sounds use the
  effects channel; the game soundtrack remains independently muted by default.
  The effects bus now binds directly to the call-owned `AudioContext` prepared by
  Participar, rather than a standalone game's separately unlocked context. Its gain
  reads only the session effects channel, not saved game mute/volume preferences.
  Switching content cancels old notes but keeps this activated output graph. Gain
  changes apply immediately, a limiter contains peaks, and teardown releases only
  effects nodes without closing the shared microphone/screen context. Interrupted
  call audio is resumed on gestures/pageshow/visibility recovery; an explicit
  activation control remains when the browser refuses automatic recovery. Old
  clicks are never accumulated for playback after unlocking.
- Phoneme words use the activity channel, not the effects channel. The game sends
  a bounded, identified `phoneme/speak` event through the authenticated call bridge.
  Each call window speaks it once with Brazilian Portuguese synthesis; no microphone
  loopback is needed. Duplicate/stale commands are ignored. A repeated click replaces
  the previous word. Activity mute, answers, reset and content changes stop speech.
  Native start/end/error callbacks report patient playback status to the professional.
  If speech is blocked, the patient gets a touch-sized activation button for the
  current word, rather than an accumulating playback queue. Browser voice availability
  and hardware speaker volume still apply; voices may differ between devices.
- Reactions have a separate gain and compressor. Repeated reactions no longer
  disconnect the game effects bus.
- Selected music keeps its existing acknowledgement, heartbeat and renderer-level
  expiry. A separate downstream mix gain cannot override that expiry.
- The game soundtrack is emitted once per call, outside the game iframe. It is
  enabled only for active games with a connected peer and a fresh mixer exchange.
  Its Web Audio envelope expires after at most 6.5 seconds without renewal, even
  when JS timers are frozen. Hidden/offline/closed calls pause playback.
- Shared screen audio has its own receiving stream and gain. It is not replayed
  through the camera video. Payment previews also avoid two audible voice players.

With voice priority enabled, detected speech attenuates activity/screen audio to
50%, effects/reactions to 45%, and music/soundtrack to 20% of the chosen levels.
Playing activity media attenuates background music; selected music attenuates a
competing game soundtrack. Chosen slider values are preserved and restored after
speech ends. Microphone gain is never reduced by this priority logic.

## Synchronization And Safety

The existing authenticated command channel carries `audio_mix`, `audio_mix_ack`
and `audio_mix_request`. Patients accept mix settings only from the authenticated
RTC admin role. Packets validate every channel, bounded gain, controller identity,
join timestamp, freshness and revision. Changes are coalesced, serialized and
retransmitted periodically. The UI reports confirmation instead of assuming an
HTTP send means the patient applied the settings. Iframes accept state only from
their same-origin parent; the call validates the source iframe for playback events.

Microphone mute disables the authorized raw track or silences its gain. Moving a
remote slider never enables a disabled raw track or opens microphone permission.
Capture recovery replaces the processed sender track and closes the previous
capture. Teardown disconnects nodes, stops generated tracks and closes call-owned
contexts. Activity media is paused when its audio controller is disposed.

## Verification

- Node tests cover channel independence, defaults, ducking, invalid/stale packets,
  microphone graph routing, bounded gain, mute preservation and raw fallback.
- Local browser verification uses two real WebRTC peers with synthetic camera and
  tone tracks, and mocked authenticated signaling. It measures received RMS before
  and after gain changes, tests mute preservation, media playback, music/reactions,
  soundtrack stop after peer departure and recommended reset.
- Layout checks include 1440x900, 390x844, 320x568 and 844x390. Native sliders have
  44px touch height. The dialog has a fixed header/close control and scrolls only
  its contents. This is not a substitute for physical iPhone/Android testing.
- These levels provide a conservative starting mix, not calibrated SPL or a
  guarantee of voice clarity on every device. Use headphones and validate real
  microphones, speaker volume, echo and low speech before clinical use.

Primary references: [Web Audio stream destination](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/createMediaStreamDestination),
[dynamics compressor](https://developer.mozilla.org/en-US/docs/Web/API/DynamicsCompressorNode),
[media element audio source](https://developer.mozilla.org/en-US/docs/Web/API/MediaElementAudioSourceNode),
[speech synthesis](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesisUtterance).
