# Content Creator speech options

Audio nodes expose **Voice** and **Language** beside the existing format selector.
Both default to **Auto (agent chooses)**. Legacy saved nodes without these fields
also display Auto; no migration is needed. Selections use the existing node
settings/persistence barrier and are included in assistant execution context.

Voices: Auto, Alloy, Echo, Fable, Onyx, Nova and Shimmer. These are Azure OpenAI
multilingual voices, not Azure Speech SSML voice names or MAI voice IDs.

Languages: Auto, English, Spanish, French, German, Italian, Portuguese, Chinese,
Japanese, Korean, Arabic, Hindi, Russian, Dutch, Polish, Turkish, Swedish,
Indonesian, Ukrainian and Vietnamese. The transmitted values are ISO 639-1 codes.

## Execution contract

- Explicit choices are carried to `generate_audio` as `voice` and `language`.
  Persisted audio node parameters take precedence over stale request context.
- Auto leaves the selection to the agent/request context; it does not force a
  literal `auto` tool argument over the agent's choice. Switching back to Auto
  removes previous forced voice/language overrides.
- The agent must write or translate the intended spoken content into the chosen
  language **before** calling the tool. Azure `tts-hd` detects language from text;
  it does not accept a language request field, translate text, or guarantee an
  accent. Prompt instructions are not part of the spoken content.
- If no voice is ultimately selected, the API uses its configured Azure voice.
  No Azure credentials are sent from the browser; synthesis stays on the API's
  direct Azure integration with no provider fallback.
- Invalid speech selections fail before assistant execution. Existing auth,
  node/site authorization and save-before-execute behavior are unchanged.

UI and contract regressions are covered by the audio parameter controls,
Imprenta assistant contract, activity prompt and message transport Jest tests.
This feature does not deploy either repository or change production secrets.