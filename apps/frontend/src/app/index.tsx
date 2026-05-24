import { Button, Card, H2, Paragraph, XStack, YStack } from "tamagui";

export default function Index() {
  return (
    <YStack
      flex={1}
      p="$5"
      style={{ justifyContent: "center", backgroundColor: "#050816" }}
      gap="$4"
    >
      <Card
        elevate
        bordered
        p="$5"
        style={{
          backgroundColor: "#0b1220",
          borderRadius: 24,
          borderColor: "#1f2a44",
        }}
        gap="$4"
      >
        <YStack gap="$3">
          <Paragraph color="#7dd3fc" fontWeight="700" letterSpacing={1.2}>
            TAMAGUI READY
          </Paragraph>
          <H2 color="#f8fafc">Sortund is styled with Tamagui now.</H2>
          <Paragraph color="#cbd5e1">
            This screen uses Tamagui primitives instead of React Native style
            objects, so you can build the rest of the app with a consistent
            token-based system.
          </Paragraph>
        </YStack>

        <XStack gap="$3" flexWrap="wrap">
          <Button size="$4" bg="#2563eb" color="#f8fafc">
            Start scanning
          </Button>
          <Button variant="outlined" size="$4">
            Browse library
          </Button>
        </XStack>
      </Card>
    </YStack>
  );
}
