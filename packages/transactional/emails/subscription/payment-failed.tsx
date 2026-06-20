import { Html, Head, Preview, Body, Container, Text, Button, Link } from '@react-email/components';

interface PaymentFailedProps {
  userName: string;
  reason: string;
  retryLink: string;
  siteUrl: string;
}

export default function PaymentFailedEmail({ userName, reason, retryLink, siteUrl }: PaymentFailedProps) {
  return (
    <Html>
      <Head />
      <Preview>Pago no procesó correctamente</Preview>
      <Body style={{ backgroundColor: '#f4f4f7', margin: 0, padding: 0 }}>
        <Container style={{ padding: '24px', backgroundColor: '#ffffff', borderRadius: '12px', boxShadow: '0 2px 12px rgba(0, 0, 0, 0.08)' }}>
          <Text style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '24px', color: '#dc2626' }}>
            ⚠️ Pago no procesó correctamente
          </Text>
          <Text style={{ fontSize: '16px', marginBottom: '16px' }}>
            Hola {userName},
          </Text>
          <Text style={{ fontSize: '16px', marginBottom: '20px' }}>
            No pudimos procesar el pago de tu suscripción. Motivo: <strong>{reason}</strong>
          </Text>
          <Text style={{ fontSize: '16px', marginBottom: '20px' }}>
            Por favor reintenta el pago lo antes posible para evitar la suspensión de tu cuenta.
          </Text>
          <Button href={retryLink} style={{ backgroundColor: '#2563eb', color: '#ffffff', padding: '12px 24px', borderRadius: '8px', textDecoration: 'none' }}>
            Reintentar pago
          </Button>
          <Text style={{ fontSize: '14px', marginTop: '24px', color: '#666' }}>
            Si el problema persiste, contacta a soporte@shopifysync.com
          </Text>
        </Container>
      </Body>
    </Html>
  );
}