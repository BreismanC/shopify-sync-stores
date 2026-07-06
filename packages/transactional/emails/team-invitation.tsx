import {
  Html,
  Head,
  Preview,
  Body,
  Container,
  Text,
  Button,
  Link,
} from '@react-email/components';

interface TeamInvitationEmailProps {
  inviterName: string;
  tenantName: string;
  acceptLink: string;
  expiresAt: Date;
  role: string;
}

export default function TeamInvitationEmail({
  inviterName,
  tenantName,
  acceptLink,
  expiresAt,
  role,
}: TeamInvitationEmailProps) {
  const formattedExpiry = expiresAt.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <Html>
      <Head />
      <Preview>{inviterName} te invitó a unirte a {tenantName}</Preview>
      <Body style={{ backgroundColor: '#f4f4f7', margin: 0, padding: 0 }}>
        <Container
          style={{
            padding: '24px',
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            boxShadow: '0 2px 12px rgba(0, 0, 0, 0.08)',
            maxWidth: '560px',
            margin: '0 auto',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          <Text
            style={{
              fontSize: '24px',
              fontWeight: 'bold',
              marginBottom: '16px',
              color: '#1a1a1a',
            }}
          >
            Te invitaron a SyncShop
          </Text>

          <Text style={{ fontSize: '16px', marginBottom: '12px', color: '#1a1a1a' }}>
            Hola,
          </Text>

          <Text style={{ fontSize: '16px', marginBottom: '20px', color: '#1a1a1a' }}>
            <strong>{inviterName}</strong> te invitó a colaborar en el espacio
            de trabajo <strong>{tenantName}</strong> como <strong>{role}</strong>.
          </Text>

          <Container
            style={{
              backgroundColor: '#f4f4f7',
              borderRadius: '8px',
              padding: '16px',
              marginBottom: '24px',
            }}
          >
            <Text style={{ fontSize: '14px', margin: 0, color: '#1a1a1a' }}>
              <strong>Empresa:</strong> {tenantName}
            </Text>
            <Text style={{ fontSize: '14px', margin: 0, color: '#1a1a1a' }}>
              <strong>Rol:</strong> {role}
            </Text>
            <Text style={{ fontSize: '14px', margin: 0, color: '#666' }}>
              <strong>Expira:</strong> {formattedExpiry}
            </Text>
          </Container>

          <Container style={{ textAlign: 'center', marginBottom: '24px' }}>
            <Button
              href={acceptLink}
              style={{
                backgroundColor: '#2563eb',
                color: '#ffffff',
                textDecoration: 'none',
                padding: '12px 24px',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: 600,
                display: 'inline-block',
              }}
            >
              Aceptar invitación
            </Button>
          </Container>

          <Text style={{ fontSize: '14px', marginBottom: '8px', color: '#666' }}>
            Si el botón no funciona, copiá y pegá este enlace en tu navegador:
          </Text>
          <Text
            style={{
              fontSize: '14px',
              wordBreak: 'break-all',
              color: '#2563eb',
              marginBottom: '20px',
            }}
          >
            <Link href={acceptLink}>{acceptLink}</Link>
          </Text>

          <Text style={{ fontSize: '12px', color: '#999', marginTop: '32px' }}>
            Si no esperabas esta invitación, podés ignorar este correo. El enlace
            expira automáticamente en 24 horas.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
