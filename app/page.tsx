export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="text-center">
        <h1 className="text-5xl font-bold text-gray-900 mb-4">
          Satvikdaan
        </h1>
        <p className="text-2xl text-gray-700 mb-8">
          Donor & Beneficiary Management System
        </p>
        <p className="text-lg text-gray-600 mb-12 max-w-2xl">
          A comprehensive platform for nonprofit organizations to manage beneficiary registrations,
          track donations, and deliver aid services with offline-first capabilities.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-16">
          <div className="bg-white rounded-lg shadow-lg p-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">📋 Beneficiary Management</h2>
            <p className="text-gray-600">
              Register, track, and manage beneficiary information with offline support for field workers
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-lg p-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">💳 Donation Tracking</h2>
            <p className="text-gray-600">
              Manage donors, track donations, generate tax receipts, and integrate with Razorpay payments
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-lg p-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">🔄 Program Management</h2>
            <p className="text-gray-600">
              Enroll beneficiaries, track aid delivery, and measure program impact with case notes
            </p>
          </div>
        </div>

        <div className="mt-16">
          <h3 className="text-xl font-bold text-gray-900 mb-6">🚀 API Endpoints Available</h3>
          <div className="bg-white rounded-lg shadow-lg p-8 text-left max-w-2xl mx-auto">
            <ul className="space-y-3 text-gray-700">
              <li className="font-mono text-sm">
                <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded">POST</span> /api/beneficiaries - Create beneficiary
              </li>
              <li className="font-mono text-sm">
                <span className="bg-green-100 text-green-700 px-2 py-1 rounded">GET</span> /api/beneficiaries - List beneficiaries
              </li>
              <li className="font-mono text-sm">
                <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded">POST</span> /api/donations - Create donation
              </li>
              <li className="font-mono text-sm">
                <span className="bg-green-100 text-green-700 px-2 py-1 rounded">GET</span> /api/donations - List donations
              </li>
              <li className="font-mono text-sm">
                <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded">POST</span> /api/sync-offline - Process offline sync queue
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-16 p-6 bg-yellow-50 border-l-4 border-yellow-400 text-left max-w-2xl mx-auto">
          <p className="text-sm text-gray-600">
            <strong>Next Steps:</strong> Organize your code files according to the Next.js folder structure guide,
            then the system will be ready for use. Documentation and implementation guides are included with your delivery.
          </p>
        </div>
      </div>
    </main>
  )
}
