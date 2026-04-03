# Bridge

This package is the ChatBridge platform runtime.

Planned responsibilities:

- load and validate app manifests
- expose app tools to the host model pipeline
- broker host-to-app and app-to-host events
- persist app sessions separately from chat transcript state
- coordinate app auth state and permission prompts

Chatbox should stay a thin host shell. The bridge owns the platform behavior and should be embeddable back into the chat experience without moving platform logic into Chatbox.
