import { Html, Head, Preview, Body, Container, Text, Button } from '@react-email/components';

interface SubscriptionSuspendedProps {
  userName: string;
  reason: string;
  suspendedDate: Date;
  reactivateLink: string;
  siteUrl: string;
}

export default function SubscriptionSuspendedEmail({ userName, reason, suspendedDate, reactivateLink, siteUrl }: SubscriptionSuspendedProps) {
  const formattedDate = new Date(suspendedDate).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });
  return (
    <Html>
      <Head />
      <Preview>Tu suscripción ha sido suspendida</Preview>
      <Body style={{ backgroundColor: '#f4f4f7', margin: 0, padding: 0 }}>
        <Container style={{ padding: '24px', backgroundColor: '#ffffff', borderRadius: '12px', boxShadow: '0 2px 12px rgba(0, 0, 0, 0.08)' }}>
          <Text style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '24px', color: '#dc2626' }}>
            Tu suscripción ha sido suspendida
          </Text>
          <Text style={{ fontSize: '16px', marginBottom: '16px' }}>
            Hola {userName},
          </Text>
          <Text style={{ fontSize: '16px', marginBottom: '20px' }}>
            Tu suscripción ha sido suspendida desde el <strong>{formattedDate}</strong>.
          </Text>
          <Text style={{ fontSize: '16px', marginBottom: '20px' }}>
            <strong>Motivo:</strong> {reason}
          </Text>
          <Text style={{ fontSize: '16px', marginBottom: '20px' }}>
            Mientras tu cuenta esté suspendida, no podrás sincronizar tiendas ni acceder a las funciones premium.
          </Text>
          <Button href={reactivateLink} style={{ backgroundColor: '#2563eb', color: '#ffffff', padding: '12px 24px', borderRadius: '8px', textDecoration: 'none' }}>
            Reactivar suscripción
          </Button>
          <Text style={{ fontSize: '14px', marginTop: '24px', color: '#666' }}>
            Si crees que esto es un error, contacta a soporte@shopifysync.com
          </Text>
        </Container>
      </Body>
    </Html>
  );
}