
import React from 'react';
import { Settings, Info } from 'lucide-react';

interface PlaceholderPageProps {
  title: string;
  description: string;
}

export const PlaceholderPage: React.FC<PlaceholderPageProps> = ({ title, description }) => {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm max-w-4xl">
        <div className="flex items-center space-x-4 mb-6">
          <div className="bg-emerald-50 p-4 rounded-full text-emerald-600">
            <Settings size={32} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-900">{title}</h2>
            <p className="text-slate-500">{description}</p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="p-6 bg-slate-50 rounded-xl border border-slate-100 flex items-start space-x-4">
            <Info className="text-blue-500 shrink-0 mt-1" size={20} />
            <div>
              <h4 className="font-semibold text-slate-800">Module Under Construction</h4>
              <p className="text-slate-600 text-sm mt-1">
                The development team is currently building out the deep-dive functionalities for this section. 
                Data connection and specialized interface tools will be available in the next release.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="h-32 bg-slate-100 rounded-lg border border-slate-200 border-dashed animate-pulse"></div>
            <div className="h-32 bg-slate-100 rounded-lg border border-slate-200 border-dashed animate-pulse"></div>
          </div>
        </div>
      </div>
    </div>
  );
};
