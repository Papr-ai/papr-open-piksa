# AI Agent Environment Decision Examples

The enhanced book creation tool now accepts AI agent decisions for environments. Here are the three options:

## Option 1: Use Existing Image As-Is

```typescript
// AI agent searches memory, finds perfect existing environment
await createEnvironments({
  bookId: "book-123",
  environments: [{
    environmentId: "rooftop-night",
    location: "Rooftop",
    timeOfDay: "Night", 
    weather: "Clear",
    masterPlateDescription: "City rooftop at night with moonlight",
    persistentElements: ["chimneys", "water tank"],
    layoutJson: {},
    existingImageUrl: "https://example.com/perfect-rooftop.jpg" // Use exactly this
  }]
});
```

## Option 2: Use Existing Image as Seed

```typescript
// AI agent finds similar environment, wants style consistency but unique version
await createEnvironments({
  bookId: "book-123", 
  environments: [{
    environmentId: "rooftop-night",
    location: "Rooftop",
    timeOfDay: "Night",
    weather: "Clear", 
    masterPlateDescription: "City rooftop at night with moonlight",
    persistentElements: ["chimneys", "water tank"],
    layoutJson: {},
    seedImageUrl: "https://example.com/similar-rooftop.jpg" // Use as style reference
  }]
});
```

## Option 3: Create Completely New

```typescript
// AI agent decides to create fresh environment
await createEnvironments({
  bookId: "book-123",
  environments: [{
    environmentId: "rooftop-night", 
    location: "Rooftop",
    timeOfDay: "Night",
    weather: "Clear",
    masterPlateDescription: "City rooftop at night with moonlight", 
    persistentElements: ["chimneys", "water tank"],
    layoutJson: {},
    createNew: true // Create from scratch
  }]
});
```

## AI Agent Decision Logic (Example)

```typescript
// In chat route - AI agent searches and decides:

const existingEnvironments = await searchMemory(`environment rooftop night ${bookId}`);

if (existingEnvironments.length > 0) {
  const existing = existingEnvironments[0];
  
  // Same book + same requirements = reuse exactly
  if (existing.bookId === bookId && existing.description === currentDescription) {
    environment.existingImageUrl = existing.imageUrl;
  }
  // Different book or different requirements = use as seed
  else {
    environment.seedImageUrl = existing.imageUrl; 
  }
} else {
  // No existing environment found = create new
  environment.createNew = true;
}
```

## Benefits

- **Full AI Agent Control**: All intelligent decisions happen in chat route
- **Tool Simplicity**: Enhanced book creation just executes decisions  
- **Flexibility**: Can always change environments even within same book
- **Style Consistency**: Can use seeds for visual coherence across books
- **Clear Options**: Three explicit choices with clear semantics

