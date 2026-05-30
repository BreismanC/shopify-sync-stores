import { auth } from '@/auth';

export default async function OnboardingPage() {
  const session = await auth();

  const steps = [
    { number: 1, title: 'Connect your Shopify store', description: 'Add your Shopify store URL and API credentials', status: 'completed' },
    { number: 2, title: 'Configure sync settings', description: 'Set up your product and order sync preferences', status: 'completed' },
    { number: 3, title: 'Invite team members', description: 'Add team members to help manage your stores', status: 'current' },
    { number: 4, title: 'Start syncing', description: 'Launch your first sync and monitor progress', status: 'pending' },
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Welcome to Shopify Sync</h2>
        <p className="text-gray-600 mt-1">Complete these steps to get started with your store synchronization.</p>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Setup Progress</h3>
              <p className="text-sm text-gray-500">2 of 4 steps completed</p>
            </div>
            <div className="text-2xl font-bold text-blue-600">50%</div>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div className="bg-blue-600 h-2 rounded-full" style={{ width: '50%' }}></div>
          </div>
        </div>

        <div className="border-t divide-y">
          {steps.map((step) => (
            <div key={step.number} className="p-6 flex items-start gap-4">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  step.status === 'completed'
                    ? 'bg-green-100 text-green-600'
                    : step.status === 'current'
                    ? 'bg-blue-100 text-blue-600'
                    : 'bg-gray-100 text-gray-400'
                }`}
              >
                {step.status === 'completed' ? (
                  <span className="text-sm font-medium">✓</span>
                ) : (
                  <span className="text-sm font-medium">{step.number}</span>
                )}
              </div>
              <div className="flex-1">
                <h4 className={`text-sm font-medium ${step.status === 'pending' ? 'text-gray-400' : 'text-gray-900'}`}>
                  {step.title}
                </h4>
                <p className={`text-sm mt-1 ${step.status === 'pending' ? 'text-gray-300' : 'text-gray-500'}`}>
                  {step.description}
                </p>
              </div>
              {step.status === 'completed' && (
                <span className="text-xs text-green-600 font-medium">Done</span>
              )}
              {step.status === 'current' && (
                <span className="text-xs text-blue-600 font-medium">In Progress</span>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h4 className="text-sm font-semibold text-blue-900">Need help?</h4>
        <p className="text-sm text-blue-700 mt-1">
          Check out our documentation or contact support if you have any questions about setting up your store.
        </p>
      </div>
    </div>
  );
}
