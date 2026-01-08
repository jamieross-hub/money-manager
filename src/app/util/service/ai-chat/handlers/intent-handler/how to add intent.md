How to Add a New Intent
Adding a new intent is now trivial:


1. Add intent constant
// chat-constants.ts
INTENTS: {
  // ... existing
  NEW_FEATURE: 'NEW_FEATURE'
}

2. Create handler
// new-feature-intent-handler.service.ts
@Injectable({ providedIn: 'root' })
export class NewFeatureIntentHandler implements IntentHandler {
  handle(context: IntentContext): HandlerResult {
    return ResponseBuilder.create()
      .html('New feature response')
      .build();
  }
}

3. Register handler
// chat-facade-service.ts constructor
this.registry.register(
  CHAT_CONSTANTS.INTENTS.NEW_FEATURE, 
  this.newFeatureHandler
);

That's it! No need to modify switch statements or core logic.