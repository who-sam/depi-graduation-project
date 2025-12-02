import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { FileText, Book, Server, Cloud, GitBranch, Shield, Wrench, AlertCircle, Download, ExternalLink } from 'lucide-react';

// NOTE: install these if you haven't already:
// npm install react-markdown remark-gfm rehype-raw lucide-react

const MarkdownComponents = {
  h1: ({ node, ...props }) => (
    <h1 className="text-3xl font-bold text-white mb-6" {...props} />
  ),
  h2: ({ node, ...props }) => (
    <h2 className="text-2xl font-bold text-white mt-8 mb-4" {...props} />
  ),
  h3: ({ node, ...props }) => (
    <h3 className="text-xl font-semibold text-white mt-6 mb-3" {...props} />
  ),
  p: ({ node, ...props }) => (
    <p className="mb-4 leading-relaxed text-slate-300" {...props} />
  ),
  a: ({ href, children, ...props }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline" {...props}>
      {children}
    </a>
  ),
  code: ({ inline, className = '', children, ...props }) => {
    if (inline) {
      return (
        <code className="bg-slate-700 text-blue-300 px-2 py-1 rounded text-sm font-mono" {...props}>
          {children}
        </code>
      );
    }

    return (
      <pre className="bg-slate-900 text-green-300 p-4 rounded-lg overflow-x-auto my-4 text-sm font-mono">
        <code className={className} {...props}>
          {children}
        </code>
      </pre>
    );
  },
  ul: ({ node, ...props }) => (
    <ul className="ml-6 list-disc space-y-2 text-slate-300" {...props} />
  ),
  ol: ({ node, ...props }) => (
    <ol className="ml-6 list-decimal space-y-2 text-slate-300" {...props} />
  ),
  li: ({ node, ...props }) => <li className="mb-1" {...props} />,
  blockquote: ({ node, ...props }) => (
    <blockquote className="border-l-4 border-blue-500 pl-4 italic my-4 text-slate-400" {...props} />
  ),
  hr: ({ node, ...props }) => <hr className="border-slate-700 my-6" {...props} />,
  table: ({ node, ...props }) => (
    <div className="overflow-x-auto my-4">
      <table className="min-w-full table-auto border-collapse" {...props} />
    </div>
  ),
  thead: ({ node, ...props }) => (
    <thead className="bg-slate-800/40 text-slate-200 text-sm" {...props} />
  ),
  tbody: ({ node, ...props }) => <tbody className="text-slate-300" {...props} />,
  tr: ({ node, ...props }) => <tr className="border-t border-slate-700" {...props} />,
  th: ({ node, ...props }) => (
    <th className="px-4 py-2 text-left font-semibold" {...props} />
  ),
  td: ({ node, ...props }) => <td className="px-4 py-2 align-top" {...props} />,
};

const DocumentationNavigator = () => {
  const [selectedDoc, setSelectedDoc] = useState('overview');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);

  const documents = [
    {
      id: 'overview',
      title: '01. Project Overview',
      icon: Book,
      description: 'Executive summary and architecture overview',
      filename: '01_PROJECT_OVERVIEW.md',
      githubPath: 'docs/01_PROJECT_OVERVIEW.md'
    },
    {
      id: 'infrastructure',
      title: '02. Infrastructure Guide',
      icon: Cloud,
      description: 'AWS EKS and Terraform infrastructure details',
      filename: '02_INFRASTRUCTURE_GUIDE.md',
      githubPath: 'docs/02_INFRASTRUCTURE_GUIDE.md'
    },
    {
      id: 'application',
      title: '03. Application Architecture',
      icon: Server,
      description: 'Frontend, backend, and database specifications',
      filename: '03_APPLICATION_ARCHITECTURE.md',
      githubPath: 'docs/03_APPLICATION_ARCHITECTURE.md'
    },
    {
      id: 'cicd',
      title: '04. CI/CD Pipeline',
      icon: GitBranch,
      description: 'Jenkins and ArgoCD deployment workflows',
      filename: '04_CICD_PIPELINE.md',
      githubPath: 'docs/04_CICD_PIPELINE.md'
    },
    {
      id: 'deployment',
      title: '05. Deployment Guide',
      icon: Wrench,
      description: 'Step-by-step deployment instructions',
      filename: '05_DEPLOYMENT_GUIDE.md',
      githubPath: 'docs/05_DEPLOYMENT_GUIDE.md'
    },
    {
      id: 'operations',
      title: '06. Operations Manual',
      icon: AlertCircle,
      description: 'Monitoring, troubleshooting, and maintenance',
      filename: '06_OPERATIONS_MANUAL.md',
      githubPath: 'docs/06_OPERATIONS_MANUAL.md'
    },
    {
      id: 'security',
      title: '07. Security Guide',
      icon: Shield,
      description: 'Security implementation and best practices',
      filename: '07_SECURITY_GUIDE.md',
      githubPath: 'docs/07_SECURITY_GUIDE.md'
    },
    {
      id: 'api',
      title: '08. API Reference',
      icon: FileText,
      description: 'Complete API endpoint documentation',
      filename: '08_API_REFERENCE.md',
      githubPath: 'docs/08_API_REFERENCE.md'
    }
  ];

  useEffect(() => {
    const loadContent = async () => {
      setLoading(true);
      const doc = documents.find(d => d.id === selectedDoc);

      try {
        // Try to load from public/docs (create public/docs and place files there)
        const response = await fetch(`/docs/${doc.filename}`);
        if (response.ok) {
          const text = await response.text();
          setContent(text);
        } else {
          // fallback markdown that renders nicely using react-markdown
          setContent(
`# ${doc.title}\n\n**Documentation file not found locally.**\n\n---\n\nTo view this document:\n\n1. Create a \`public/docs/\` folder in your project root.\n2. Save the markdown files in that folder (filename: \`${doc.filename}\`).\n3. Reload this page.\n\nAlternatively, click \"View on GitHub\" to open the file in the repository.`
          );
        }
      } catch (error) {
        setContent(`# Error\n\n${error.message}`);
      }

      setLoading(false);
    };

    loadContent();
  }, [selectedDoc]);

  const currentDoc = documents.find(d => d.id === selectedDoc);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-white mb-4">MIND Project Documentation</h1>
          <p className="text-xl text-slate-300">Comprehensive technical documentation suite</p>
          <div className="mt-6 inline-block bg-blue-500/20 border border-blue-400/30 rounded-lg px-6 py-3">
            <p className="text-blue-200 text-sm">Eight detailed documents covering all aspects of the system</p>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Sidebar Navigation */}
          <div className="lg:col-span-1 space-y-4">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-semibold text-white">Documentation Index</h2>
            </div>

            {documents.map((doc) => {
              const Icon = doc.icon;
              return (
                <button
                  key={doc.id}
                  onClick={() => setSelectedDoc(doc.id)}
                  className={`w-full text-left p-4 rounded-lg border-2 transition-all duration-200 ${
                    selectedDoc === doc.id
                      ? 'bg-blue-500/20 border-blue-400 shadow-lg shadow-blue-500/20'
                      : 'bg-slate-800/50 border-slate-700 hover:border-slate-600 hover:bg-slate-800/70'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <Icon className={`w-6 h-6 mt-1 flex-shrink-0 ${
                      selectedDoc === doc.id ? 'text-blue-400' : 'text-slate-400'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <h3 className={`font-semibold mb-1 ${
                        selectedDoc === doc.id ? 'text-white' : 'text-slate-200'
                      }`}>
                        {doc.title}
                      </h3>
                      <p className="text-sm text-slate-400">{doc.description}</p>
                      <p className="text-xs text-slate-500 mt-2 font-mono">{doc.filename}</p>
                    </div>
                  </div>
                </button>
              );
            })}

            {/* Action Buttons */}
            <div className="mt-8 space-y-3">
              <a
                href={`https://github.com/who-sam/MIND/blob/main/${currentDoc.githubPath}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 w-full px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                <span className="text-sm">View on GitHub</span>
              </a>

              <a
                href={`/docs/${currentDoc.filename}`}
                download={currentDoc.filename}
                className="flex items-center gap-2 w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                <Download className="w-4 h-4" />
                <span className="text-sm">Download MD File</span>
              </a>
            </div>
          </div>

          {/* Content Area */}
          <div className="lg:col-span-2">
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-8">
              {/* Document Header */}
              <div className="flex items-center gap-3 mb-6 pb-6 border-b border-slate-700">
                {React.createElement(currentDoc.icon, { className: 'w-8 h-8 text-blue-400' })}
                <div>
                  <h2 className="text-2xl font-bold text-white">{currentDoc.title}</h2>
                  <p className="text-slate-400 text-sm mt-1">{currentDoc.filename}</p>
                </div>
              </div>

              {/* Document Content */}
              <div className="prose prose-invert max-w-none">
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400"></div>
                  </div>
                ) : (
                  <div className="text-slate-300 leading-relaxed">
                    <ReactMarkdown
                      children={content}
                      remarkPlugins={[remarkGfm]}
                      rehypePlugins={[rehypeRaw]}
                      components={MarkdownComponents}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Setup Instructions */}
        {/* <div className="mt-12 bg-slate-800/30 border border-slate-700 rounded-lg p-6"> */}
        {/*   <h3 className="text-lg font-semibold text-white mb-4">📦 Setup Instructions</h3> */}
        {/*   <div className="grid md:grid-cols-3 gap-6 text-sm"> */}
        {/*     <div> */}
        {/*       <h4 className="font-semibold text-blue-400 mb-2">Step 1: Create Folder</h4> */}
        {/*       <p className="text-slate-300">Create a <code className="bg-slate-700 px-2 py-1 rounded text-xs">public/docs/</code> folder in your React project</p> */}
        {/*     </div> */}
        {/*     <div> */}
        {/*       <h4 className="font-semibold text-blue-400 mb-2">Step 2: Add Files</h4> */}
        {/*       <p className="text-slate-300">Save all 8 markdown documentation files into that folder</p> */}
        {/*     </div> */}
        {/*     <div> */}
        {/*       <h4 className="font-semibold text-blue-400 mb-2">Step 3: Reload</h4> */}
        {/*       <p className="text-slate-300">Refresh this page and the documentation will be loaded and rendered automatically</p> */}
        {/*     </div> */}
        {/*   </div> */}
        {/* </div> */}
      </div>
    </div>
  );
};

export default DocumentationNavigator;

