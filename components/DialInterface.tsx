'use client';

import { useState } from 'react';

type AmdStrategy = 'twilio_native' | 'jambonz' | 'huggingface' | 'gemini';

export default function DialInterface() {
  const [targetNumber, setTargetNumber] = useState('');
  const [amdStrategy, setAmdStrategy] = useState<AmdStrategy>('twilio_native');
  const [isDialing, setIsDialing] = useState(false);
  const [callStatus, setCallStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [callInfo, setCallInfo] = useState<any>(null);

  const handleDial = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsDialing(true);
    setError(null);
    setCallStatus('Initiating call...');
    setCallInfo(null);

    try {
      // Validate phone number format (US or India)
      if (!targetNumber.match(/^(\+1\d{10}|\+91\d{10})$/)) {
        throw new Error('Phone number must be in format: US (+1XXXXXXXXXX) or India (+91XXXXXXXXXX)');
      }

      const response = await fetch('/api/dial', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          targetNumber,
          amdStrategy,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Show the actual error message from the server
        const errorMsg = data.error || data.message || `Failed to initiate call (${response.status})`;
        if (data.hint) {
          throw new Error(`${errorMsg}. ${data.hint}`);
        }
        throw new Error(errorMsg);
      }

      setCallInfo(data.call);
      setCallStatus(`Call initiated with ${amdStrategy} strategy. Status: ${data.call.status}`);
      
      // Poll for call updates
      pollCallStatus(data.call.id);
    } catch (err: any) {
      setError(err.message || 'Failed to dial');
      setCallStatus(null);
    } finally {
      setIsDialing(false);
    }
  };

  const pollCallStatus = async (callId: string) => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/calls/${callId}`);
        
        // Check if response is OK and is JSON
        if (!response.ok) {
          if (response.status === 404) {
            // Call not found - might have been deleted or invalid ID
            console.warn(`Call ${callId} not found (404) - stopping polling`);
            setCallStatus('Call not found. It may have been deleted or failed to create.');
          } else {
            console.error('Polling error:', response.status, response.statusText);
          }
          clearInterval(interval);
          return;
        }

        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          console.error('Polling error: Response is not JSON');
          clearInterval(interval);
          return;
        }

        const data = await response.json();
        
        if (data.call) {
          setCallInfo(data.call);
          // Format confidence display
          let confidenceDisplay = 'Waiting...';
          if (data.call.amdConfidence !== null && data.call.amdConfidence !== undefined) {
            confidenceDisplay = (data.call.amdConfidence * 100).toFixed(1) + '%';
          } else if (data.call.status === 'RINGING' || data.call.status === 'PENDING') {
            confidenceDisplay = 'Waiting for detection...';
          } else if (data.call.amdResult && data.call.amdResult !== 'UNDECIDED') {
            confidenceDisplay = 'N/A';
          }
          
          setCallStatus(
            `Status: ${data.call.status} | AMD Result: ${data.call.amdResult || 'Pending'} | Confidence: ${confidenceDisplay}`
          );

          // Stop polling if call is completed
          if (['COMPLETED', 'FAILED', 'BUSY', 'NO_ANSWER'].includes(data.call.status)) {
            clearInterval(interval);
          }
        } else {
          // No call data, stop polling
          clearInterval(interval);
        }
      } catch (error) {
        console.error('Polling error:', error);
        // Stop polling on repeated errors
        clearInterval(interval);
      }
    }, 2000); // Poll every 2 seconds

    // Stop polling after 5 minutes
    setTimeout(() => clearInterval(interval), 5 * 60 * 1000);
  };

  const strategyDescriptions: Record<AmdStrategy, string> = {
    twilio_native: 'Twilio Native AMD - Built-in ML model (~85-90% accuracy)',
    jambonz: 'Jambonz AMD - SIP-based with customizable thresholds',
    huggingface: 'Hugging Face Model - Fine-tuned wav2vec for voicemail detection',
    gemini: 'Gemini Flash Real-Time - Google LLM for multimodal audio analysis',
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white dark:bg-slate-800/90 backdrop-blur-sm shadow-lg border border-slate-200 dark:border-slate-700 rounded-2xl p-6 md:p-8 transition-colors duration-200">
        <h2 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-slate-700 to-cyan-600 dark:from-cyan-400 dark:to-teal-400 bg-clip-text text-transparent mb-6">
          Initiate Outbound Call
        </h2>
        
        <form onSubmit={handleDial} className="space-y-6">
          {/* Target Number */}
          <div>
            <label htmlFor="targetNumber" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
              Target Phone Number (US Toll-Free)
            </label>
            <input
              type="tel"
              id="targetNumber"
              value={targetNumber}
              onChange={(e) => setTargetNumber(e.target.value)}
              placeholder="+18005551234"
              className="w-full px-4 py-3 bg-white dark:bg-slate-700/50 border border-gray-300 dark:border-slate-600 rounded-lg shadow-sm focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 dark:focus:ring-cyan-400 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-colors duration-200"
              required
              pattern="^(\+1\d{10}|\+91\d{10})$"
            />
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Format: US (+1XXXXXXXXXX) or India (+91XXXXXXXXXX). Example: +18007742678
            </p>
          </div>

          {/* AMD Strategy Selection */}
          <div>
            <label htmlFor="amdStrategy" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
              AMD Strategy
            </label>
            <select
              id="amdStrategy"
              value={amdStrategy}
              onChange={(e) => setAmdStrategy(e.target.value as AmdStrategy)}
              className="w-full px-4 py-3 bg-white dark:bg-slate-700/50 border border-gray-300 dark:border-slate-600 rounded-lg shadow-sm focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 dark:focus:ring-cyan-400 text-gray-900 dark:text-white transition-colors duration-200"
            >
              <option value="twilio_native">Twilio Native AMD</option>
              <option value="jambonz">Jambonz AMD</option>
              <option value="huggingface">Hugging Face Model</option>
              <option value="gemini">Gemini Flash Real-Time</option>
            </select>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 italic">
              {strategyDescriptions[amdStrategy]}
            </p>
          </div>

          {/* Dial Button */}
          <button
            type="submit"
            disabled={isDialing}
            className="w-full bg-gradient-to-r from-slate-700 to-cyan-500 dark:from-slate-600 dark:to-teal-500 text-white py-3 px-4 rounded-lg hover:from-slate-800 hover:to-cyan-600 dark:hover:from-slate-700 dark:hover:to-teal-600 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 dark:focus:ring-offset-slate-800 disabled:opacity-50 disabled:cursor-not-allowed font-semibold transform hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 shadow-lg shadow-cyan-500/25 dark:shadow-teal-500/25"
          >
            {isDialing ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Dialing...
              </span>
            ) : (
              'Dial Now'
            )}
          </button>
        </form>

        {/* Status Display */}
        {callStatus && (
          <div className="mt-6 p-4 bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-800 rounded-lg backdrop-blur-sm">
            <p className="text-sm text-cyan-800 dark:text-cyan-200">{callStatus}</p>
          </div>
        )}

        {error && (
          <div className="mt-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg backdrop-blur-sm animate-shake">
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        {callInfo && (
          <div className="mt-6 p-4 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-lg backdrop-blur-sm">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">Call Details</h3>
            <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
              <p>Call ID: {callInfo.id}</p>
              <p>Twilio SID: {callInfo.twilioCallSid || 'N/A'}</p>
              <p>Strategy: {callInfo.amdStrategy}</p>
            </div>
          </div>
        )}

        {/* Test Numbers Reference */}
        <div className="mt-8 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg backdrop-blur-sm">
          <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-200 mb-2">Test Numbers (Voicemail)</h3>
          <ul className="text-xs text-amber-800 dark:text-amber-300 space-y-1 list-disc list-inside">
            <li>Costco: +18007742678</li>
            <li>Nike: +18008066453</li>
            <li>PayPal: +18882211161</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

