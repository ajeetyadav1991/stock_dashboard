// Complete Production Frontend - App.jsx
// Save as: frontend/src/App.jsx

import React, { useState, useEffect } from 'react';
import { Upload, TrendingUp, AlertTriangle, BarChart3, FileText, Calendar, Plus, RefreshCw } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';

// API Configuration
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

// API Client
const api = {
  async request(endpoint, options = {}) {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        ...options.headers,
      },
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Request failed' }));
      throw new Error(error.detail || 'Request failed');
    }
    
    return response.json();
  },

  // Companies
  async getCompanies() {
    return this.request('/api/companies');
  },

  async createCompany(data) {
    return this.request('/api/companies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },

  // Documents
  async uploadDocument(file, companySymbol, fiscalYear) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('company_symbol', companySymbol);
    formData.append('fiscal_year', fiscalYear);

    return this.request('/api/documents/upload', {
      method: 'POST',
      body: formData,
    });
  },

  async getDocuments(companySymbol) {
    return this.request(`/api/documents/${companySymbol}`);
  },

  // Analysis
  async startAnalysis(companySymbol, fiscalYear) {
    const formData = new FormData();
    formData.append('company_symbol', companySymbol);
    formData.append('fiscal_year', fiscalYear);

    return this.request('/api/analysis/risk-evolution', {
      method: 'POST',
      body: formData,
    });
  },

  async getAnalysisStatus(jobId) {
    return this.request(`/api/analysis/status/${jobId}`);
  },

  async getRiskHistory(companySymbol) {
    return this.request(`/api/results/risk-evolution/${companySymbol}`);
  },
};

// Main App Component
function App() {
  const [companies, setCompanies] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [riskHistory, setRiskHistory] = useState([]);
  const [activeTab, setActiveTab] = useState('upload');
  const [loading, setLoading] = useState(false);
  const [showAddCompany, setShowAddCompany] = useState(false);
  const [newCompany, setNewCompany] = useState({ symbol: '', name: '', sector: '' });
  const [uploadYear, setUploadYear] = useState(2024);
  const [analysisJobs, setAnalysisJobs] = useState({});

  // Load companies on mount
  useEffect(() => {
    loadCompanies();
  }, []);

  // Load documents and results when company changes
  useEffect(() => {
    if (selectedCompany) {
      loadDocuments(selectedCompany.symbol);
      loadRiskHistory(selectedCompany.symbol);
    }
  }, [selectedCompany]);

  // Poll analysis jobs
  useEffect(() => {
    const activeJobs = Object.entries(analysisJobs).filter(([_, job]) => 
      job.status === 'pending' || job.status === 'processing'
    );

    if (activeJobs.length > 0) {
      const interval = setInterval(async () => {
        for (const [jobId, _] of activeJobs) {
          try {
            const status = await api.getAnalysisStatus(jobId);
            setAnalysisJobs(prev => ({ ...prev, [jobId]: status }));
            
            if (status.status === 'completed') {
              // Reload risk history
              if (selectedCompany) {
                loadRiskHistory(selectedCompany.symbol);
              }
            }
          } catch (error) {
            console.error('Error polling job:', error);
          }
        }
      }, 2000);

      return () => clearInterval(interval);
    }
  }, [analysisJobs, selectedCompany]);

  async function loadCompanies() {
    try {
      const data = await api.getCompanies();
      setCompanies(data);
    } catch (error) {
      alert('Failed to load companies: ' + error.message);
    }
  }

  async function loadDocuments(symbol) {
    try {
      const data = await api.getDocuments(symbol);
      setDocuments(data);
    } catch (error) {
      console.error('Failed to load documents:', error);
    }
  }

  async function loadRiskHistory(symbol) {
    try {
      const data = await api.getRiskHistory(symbol);
      setRiskHistory(data);
    } catch (error) {
      console.error('Failed to load risk history:', error);
    }
  }

  async function handleAddCompany() {
    if (!newCompany.symbol || !newCompany.name) {
      alert('Please fill in symbol and name');
      return;
    }

    try {
      await api.createCompany(newCompany);
      await loadCompanies();
      setNewCompany({ symbol: '', name: '', sector: '' });
      setShowAddCompany(false);
      alert('✅ Company added successfully');
    } catch (error) {
      alert('Failed to add company: ' + error.message);
    }
  }

  async function handleFileUpload(event, year) {
    const file = event.target.files[0];
    if (!file || !selectedCompany) return;

    setLoading(true);
    try {
      await api.uploadDocument(file, selectedCompany.symbol, year);
      await loadDocuments(selectedCompany.symbol);
      alert(`✅ Successfully uploaded ${file.name}`);
    } catch (error) {
      alert('Upload failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleRunAnalysis(year) {
    if (!selectedCompany) return;

    setLoading(true);
    try {
      const result = await api.startAnalysis(selectedCompany.symbol, year);
      const jobId = result.job_id;
      
      setAnalysisJobs(prev => ({
        ...prev,
        [jobId]: { status: 'pending', progress: 0, message: 'Starting...' }
      }));
      
      setActiveTab('dashboard');
      alert('✅ Analysis started! Check progress in Dashboard tab.');
    } catch (error) {
      alert('Analysis failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  // Prepare chart data
  const latestResult = riskHistory.length > 0 ? riskHistory[riskHistory.length - 1] : null;
  
  const riskTrendData = riskHistory.map(r => ({
    year: `FY${r.fiscal_year}`,
    urgency: r.urgency_score,
    sentiment: Math.abs(r.sentiment_delta || 0)
  }));

  const radarData = latestResult 
    ? Object.entries(latestResult.risk_categories || {}).map(([category, score]) => ({
        category: category.replace(/_/g, ' ').toUpperCase(),
        score: Math.abs(score)
      }))
    : [];

  const getDocForYear = (year) => documents.find(d => d.fiscal_year === year);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 text-white p-6">
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-5xl font-bold mb-2 bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
            The Narrative Quantifier
          </h1>
          <p className="text-slate-300 text-lg">
            AI-Powered Qualitative Analysis for Indian Equity Markets
          </p>
        </div>

        {/* Company Selector */}
        <div className="bg-slate-800/50 backdrop-blur rounded-xl p-6 mb-6 border border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <label className="text-sm font-semibold text-slate-300">SELECT COMPANY:</label>
              <select 
                value={selectedCompany?.symbol || ''} 
                onChange={(e) => {
                  const company = companies.find(c => c.symbol === e.target.value);
                  setSelectedCompany(company);
                }}
                className="bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- Choose Company --</option>
                {companies.map(c => (
                  <option key={c.symbol} value={c.symbol}>
                    {c.symbol} - {c.name}
                  </option>
                ))}
              </select>
            </div>
            
            <button
              onClick={() => setShowAddCompany(!showAddCompany)}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg transition"
            >
              <Plus size={18} />
              Add Company
            </button>
          </div>

          {showAddCompany && (
            <div className="mt-4 p-4 bg-slate-700/50 rounded-lg border border-slate-600">
              <div className="grid grid-cols-3 gap-4 mb-3">
                <input
                  type="text"
                  placeholder="Symbol (e.g., HDFC)"
                  value={newCompany.symbol}
                  onChange={(e) => setNewCompany(prev => ({ ...prev, symbol: e.target.value.toUpperCase() }))}
                  className="bg-slate-600 border border-slate-500 rounded px-3 py-2 text-white"
                />
                <input
                  type="text"
                  placeholder="Company Name"
                  value={newCompany.name}
                  onChange={(e) => setNewCompany(prev => ({ ...prev, name: e.target.value }))}
                  className="bg-slate-600 border border-slate-500 rounded px-3 py-2 text-white"
                />
                <input
                  type="text"
                  placeholder="Sector"
                  value={newCompany.sector}
                  onChange={(e) => setNewCompany(prev => ({ ...prev, sector: e.target.value }))}
                  className="bg-slate-600 border border-slate-500 rounded px-3 py-2 text-white"
                />
              </div>
              <button
                onClick={handleAddCompany}
                className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded transition"
              >
                Add Company
              </button>
            </div>
          )}

          {selectedCompany && (
            <div className="mt-4 p-4 bg-blue-900/30 rounded-lg border border-blue-700">
              <div className="text-sm text-slate-300">
                <strong className="text-blue-400">{selectedCompany.name}</strong> ({selectedCompany.symbol})
                {selectedCompany.sector && ` • ${selectedCompany.sector}`}
              </div>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {['upload', 'dashboard', 'history'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-3 rounded-lg font-semibold transition ${
                activeTab === tab
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {tab === 'upload' && '📤 Upload Documents'}
              {tab === 'dashboard' && '📊 Analysis Dashboard'}
              {tab === 'history' && '📜 Historical View'}
            </button>
          ))}
        </div>

        {/* Upload Tab */}
        {activeTab === 'upload' && (
          <div className="bg-slate-800/50 backdrop-blur rounded-xl p-8 border border-slate-700">
            {!selectedCompany ? (
              <div className="text-center py-12">
                <FileText size={64} className="mx-auto mb-4 text-slate-600" />
                <p className="text-slate-400 text-lg">Please select a company first</p>
              </div>
            ) : (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                  <Upload className="text-blue-400" />
                  Upload Annual Reports for {selectedCompany.symbol}
                </h2>

                {[2024, 2023, 2022, 2021].map(year => {
                  const doc = getDocForYear(year);
                  
                  return (
                    <div key={year} className="bg-slate-700/50 rounded-lg p-6 border border-slate-600">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <Calendar className="text-cyan-400" size={24} />
                          <h3 className="text-xl font-semibold">FY {year}</h3>
                          {doc && (
                            <span className="bg-green-600 text-white text-xs px-3 py-1 rounded-full">
                              ✓ Uploaded
                            </span>
                          )}
                        </div>
                      </div>

                      {doc ? (
                        <div className="bg-slate-600/50 rounded p-4 mb-4">
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="text-slate-400">Pages:</span> {doc.page_count}
                            </div>
                            <div>
                              <span className="text-slate-400">Words:</span> {doc.word_count?.toLocaleString()}
                            </div>
                            <div>
                              <span className="text-slate-400">Uploaded:</span> {new Date(doc.upload_date).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <label className="block cursor-pointer">
                          <div className="border-2 border-dashed border-slate-600 rounded-lg p-8 text-center hover:border-blue-500 transition">
                            <FileText className="mx-auto mb-3 text-slate-500" size={48} />
                            <p className="text-slate-400">Click to upload Annual Report PDF</p>
                          </div>
                          <input
                            type="file"
                            accept=".pdf"
                            onChange={(e) => handleFileUpload(e, year)}
                            className="hidden"
                            disabled={loading}
                          />
                        </label>
                      )}

                      {doc && (
                        <button
                          onClick={() => handleRunAnalysis(year)}
                          disabled={loading}
                          className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 px-6 py-3 rounded-lg font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                          {loading ? (
                            <>
                              <RefreshCw className="animate-spin" size={18} />
                              Analyzing...
                            </>
                          ) : (
                            <>🚀 Run Risk Analysis</>
                          )}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* Active Jobs */}
            {Object.entries(analysisJobs).filter(([_, job]) => 
              job.status === 'pending' || job.status === 'processing'
            ).length > 0 && (
              <div className="bg-slate-800/50 backdrop-blur rounded-xl p-6 border border-slate-700">
                <h3 className="text-lg font-bold mb-4">🔄 Active Analysis Jobs</h3>
                {Object.entries(analysisJobs)
                  .filter(([_, job]) => job.status === 'pending' || job.status === 'processing')
                  .map(([jobId, job]) => (
                    <div key={jobId} className="mb-3">
                      <div className="flex justify-between text-sm mb-1">
                        <span>{job.message}</span>
                        <span>{job.progress}%</span>
                      </div>
                      <div className="w-full bg-slate-700 rounded-full h-2">
                        <div 
                          className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${job.progress}%` }}
                        />
                      </div>
                    </div>
                  ))}
              </div>
            )}

            {!latestResult ? (
              <div className="bg-slate-800/50 backdrop-blur rounded-xl p-12 border border-slate-700 text-center">
                <BarChart3 size={64} className="mx-auto mb-4 text-slate-600" />
                <p className="text-slate-400 text-lg">No analysis results yet. Upload documents and run analysis first.</p>
              </div>
            ) : (
              <>
                {/* Metrics Cards */}
                <div className="grid grid-cols-3 gap-6">
                  <div className="bg-gradient-to-br from-red-900/50 to-red-800/30 rounded-xl p-6 border border-red-700">
                    <div className="flex items-center gap-3 mb-2">
                      <AlertTriangle className="text-red-400" size={28} />
                      <h3 className="text-lg font-semibold">Urgency Score</h3>
                    </div>
                    <p className="text-4xl font-bold text-red-400">{latestResult.urgency_score.toFixed(1)}/100</p>
                    <p className="text-sm text-slate-300 mt-2">Overall risk urgency level</p>
                  </div>

                  <div className="bg-gradient-to-br from-orange-900/50 to-orange-800/30 rounded-xl p-6 border border-orange-700">
                    <div className="flex items-center gap-3 mb-2">
                      <TrendingUp className="text-orange-400" size={28} />
                      <h3 className="text-lg font-semibold">Sentiment Delta</h3>
                    </div>
                    <p className="text-4xl font-bold text-orange-400">
                      {latestResult.sentiment_delta 
                        ? `${latestResult.sentiment_delta > 0 ? '+' : ''}${latestResult.sentiment_delta.toFixed(1)}%` 
                        : 'N/A'}
                    </p>
                    <p className="text-sm text-slate-300 mt-2">Change vs previous year</p>
                  </div>

                  <div className="bg-gradient-to-br from-blue-900/50 to-blue-800/30 rounded-xl p-6 border border-blue-700">
                    <div className="flex items-center gap-3 mb-2">
                      <FileText className="text-blue-400" size={28} />
                      <h3 className="text-lg font-semibold">Latest Analysis</h3>
                    </div>
                    <p className="text-4xl font-bold text-blue-400">FY{latestResult.fiscal_year}</p>
                    <p className="text-sm text-slate-300 mt-2">{new Date(latestResult.analyzed_at).toLocaleDateString()}</p>
                  </div>
                </div>

                {/* Radar Chart */}
                <div className="bg-slate-800/50 backdrop-blur rounded-xl p-6 border border-slate-700">
                  <h3 className="text-xl font-bold mb-4">📊 Risk Category Breakdown</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <RadarChart data={radarData}>
                      <PolarGrid stroke="#475569" />
                      <PolarAngleAxis dataKey="category" tick={{ fill: '#cbd5e1', fontSize: 12 }} />
                      <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fill: '#cbd5e1' }} />
                      <Radar name="Risk Score" dataKey="score" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.6} />
                      <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>

                {/* Trend Chart */}
                {riskHistory.length > 1 && (
                  <div className="bg-slate-800/50 backdrop-blur rounded-xl p-6 border border-slate-700">
                    <h3 className="text-xl font-bold mb-4">📈 Risk Trend Over Time</h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={riskTrendData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                        <XAxis dataKey="year" stroke="#cbd5e1" />
                        <YAxis stroke="#cbd5e1" />
                        <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }} />
                        <Legend />
                        <Line type="monotone" dataKey="urgency" stroke="#ef4444" strokeWidth={2} name="Urgency Score" />
                        <Line type="monotone" dataKey="sentiment" stroke="#f59e0b" strokeWidth={2} name="Sentiment Change" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Key Phrases */}
                <div className="bg-slate-800/50 backdrop-blur rounded-xl p-6 border border-slate-700">
                  <h3 className="text-xl font-bold mb-4">🔑 Key Risk Phrases</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {latestResult.key_phrases.map((phrase, idx) => (
                      <div key={idx} className="bg-slate-700/50 rounded-lg p-3 text-sm border border-slate-600">
                        "{phrase}"
                      </div>
                    ))}
                  </div>
                </div>

                {/* New Risks */}
                {latestResult.new_risks && latestResult.new_risks.length > 0 && (
                  <div className="bg-red-900/20 backdrop-blur rounded-xl p-6 border border-red-800">
                    <h3 className="text-xl font-bold mb-4 text-red-400">🆕 New Risks Identified</h3>
                    <ul className="space-y-2">
                      {latestResult.new_risks.map((risk, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-red-400 mt-1">•</span>
                          <span className="text-slate-300">{risk}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Summary */}
                <div className="bg-slate-800/50 backdrop-blur rounded-xl p-6 border border-slate-700">
                  <h3 className="text-xl font-bold mb-4">📝 Executive Summary</h3>
                  <p className="text-slate-300 leading-relaxed">{latestResult.summary}</p>
                </div>
              </>
            )}
          </div>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <div className="bg-slate-800/50 backdrop-blur rounded-xl p-8 border border-slate-700">
            <h2 className="text-2xl font-bold mb-6">Historical Analysis Records</h2>
            
            {riskHistory.length === 0 ? (
              <div className="text-center py-12">
                <FileText size={64} className="mx-auto mb-4 text-slate-600" />
                <p className="text-slate-400 text-lg">No historical data available yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {riskHistory.map((result, idx) => (
                  <div key={idx} className="bg-slate-700/50 rounded-lg p-6 border border-slate-600">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-xl font-bold text-blue-400">FY {result.fiscal_year}</h3>
                        <p className="text-sm text-slate-400">Analyzed: {new Date(result.analyzed_at).toLocaleDateString()}</p>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-red-400">{result.urgency_score.toFixed(1)}/100</div>
                        <div className="text-sm text-slate-400">Urgency</div>
                      </div>
                    </div>
                    
                    <p className="text-slate-300 mb-4">{result.summary}</p>
                    
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-slate-400">Risk Categories:</span> {Object.keys(result.risk_categories).length}
                      </div>
                      <div>
                        <span className="text-slate-400">New Risks:</span> {result.new_risks?.length || 0}
                      </div>
                      <div>
                        <span className="text-slate-400">Key Phrases:</span> {result.key_phrases?.length || 0}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Loading Overlay */}
        {loading && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-slate-800 rounded-xl p-8 border border-slate-700 text-center">
              <RefreshCw className="animate-spin h-16 w-16 text-blue-500 mx-auto mb-4" />
              <p className="text-xl font-semibold">Processing...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;