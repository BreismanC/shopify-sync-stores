import {
  Html,
  Head,
  Preview,
  Body,
  Container,
  Text,
  Section,
} from "@react-email/components";

type EmailStoreRole = "SOURCE" | "VENDOR";

interface StoreConnectionKeyEmailProps {
  inviterName: string;
  role: EmailStoreRole;
  shopifyShopId: string;
  storeKey: string;
}

export default function StoreConnectionKeyEmail({
  inviterName,
  role,
  shopifyShopId,
  storeKey,
}: StoreConnectionKeyEmailProps) {
  const expectedRecipientRole: EmailStoreRole =
    role === "SOURCE" ? "VENDOR" : "SOURCE";

  return (
    <Html>
      <Head />
      <Preview>Store key para vincular tu tienda en SyncShop</Preview>
      <Body
        style={{
          backgroundColor: "#f4f4f7",
          margin: 0,
          padding: 0,
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <Container
          style={{
            padding: "24px",
            backgroundColor: "#ffffff",
            borderRadius: "12px",
            boxShadow: "0 2px 12px rgba(0, 0, 0, 0.08)",
            maxWidth: "560px",
            margin: "0 auto",
          }}
        >
          <Text
            style={{
              fontSize: "24px",
              fontWeight: "bold",
              marginBottom: "16px",
              color: "#1a1a1a",
            }}
          >
            Vinculá tu tienda con SyncShop
          </Text>

          <Text
            style={{
              fontSize: "16px",
              marginBottom: "12px",
              color: "#1a1a1a",
            }}
          >
            Hola,
          </Text>

          <Text
            style={{
              fontSize: "16px",
              marginBottom: "20px",
              color: "#1a1a1a",
            }}
          >
            <strong>{inviterName}</strong> quiere conectar su tienda
            <strong> {shopifyShopId}</strong> (rol {role}) con la tuya.
          </Text>

          <Section
            style={{
              backgroundColor: "#f4f4f7",
              borderRadius: "8px",
              padding: "16px",
              marginBottom: "24px",
            }}
          >
            <Text
              style={{
                fontSize: "14px",
                margin: "0 0 8px 0",
                color: "#1a1a1a",
              }}
            >
              <strong>Tienda que solicita la conexión:</strong> {shopifyShopId}
            </Text>
            <Text
              style={{
                fontSize: "14px",
                margin: "0 0 8px 0",
                color: "#1a1a1a",
              }}
            >
              <strong>Rol esperado del destinatario:</strong>{" "}
              {expectedRecipientRole}
            </Text>
            <Text style={{ fontSize: "14px", margin: 0, color: "#1a1a1a" }}>
              <strong>Store Key:</strong>{" "}
              <span
                style={{ fontFamily: "monospace", letterSpacing: "0.05em" }}
              >
                {storeKey}
              </span>
            </Text>
          </Section>

          <Text
            style={{
              fontSize: "15px",
              marginBottom: "16px",
              color: "#1a1a1a",
            }}
          >
            Para completar la vinculación, ingresá al panel de SyncShop y pegá
            esta clave en el formulario{" "}
            <strong>Conectar tienda por storeKey</strong>.
          </Text>

          <Text
            style={{
              fontSize: "14px",
              marginBottom: "8px",
              color: "#1a1a1a",
            }}
          >
            Pasos:
          </Text>
          <Text
            style={{
              fontSize: "14px",
              margin: "0 0 8px 0",
              color: "#1a1a1a",
            }}
          >
            1. Iniciá sesión en SyncShop con la cuenta de tu tienda (
            {expectedRecipientRole}).
          </Text>
          <Text
            style={{
              fontSize: "14px",
              margin: "0 0 8px 0",
              color: "#1a1a1a",
            }}
          >
            2. En el dashboard, abrí la sección <strong>Stores</strong> →
            <strong> Conectar tienda</strong>.
          </Text>
          <Text
            style={{
              fontSize: "14px",
              margin: "0 0 8px 0",
              color: "#1a1a1a",
            }}
          >
            3. Pegá la storeKey de arriba y confirmá la conexión.
          </Text>

          <Text
            style={{
              fontSize: "12px",
              color: "#999",
              marginTop: "32px",
            }}
          >
            Si no esperás esta solicitud, podés ignorar este correo. Esta clave
            no vence pero solo sirve para conectar tu tienda con SyncShop.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
