import { useState } from 'react';
import { ChevronDown, ChevronRight, Image, Users, MapPin, Sparkles, Palette, Check, X, Eye, Copy, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CreationResult {
  step: string;
  success: boolean;
  item: string;
  imageUrl?: string;
  memoryId?: string;
  error?: string;
  prompt?: string;
  approach?: string;
  seedImagesUsed?: string[];
  existingAsset?: boolean;
  reasoning?: string;
}

interface StructuredBookImageResult {
  success: boolean;
  bookId: string;
  results: {
    characterPortraits: CreationResult[];
    environments: CreationResult[];
    scenes: CreationResult[];
  };
  summary: {
    charactersCreated: number;
    environmentsCreated: number;
    scenesCreated: number;
    totalImagesCreated: number;
  };
  nextSteps: string;
  needsApproval?: 'characters' | 'environments';
  uiProgressData?: {
    characterPortraits: CreationResult[];
    environments: CreationResult[];
    scenes: CreationResult[];
  };
}

interface StructuredBookImageResultsProps {
  result: StructuredBookImageResult;
  isReadonly?: boolean;
}

export function StructuredBookImageResults({ result, isReadonly }: StructuredBookImageResultsProps) {
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  if (!result.success) {
    return (
      <div className="w-fit max-w-full border rounded-lg p-4 bg-red-50 border-red-200">
        <div className="flex items-center gap-3">
          <div className="text-2xl">❌</div>
          <div>
            <h3 className="font-semibold text-sm text-red-800">Structured Image Creation Failed</h3>
            <p className="text-xs text-red-600 mt-1">
              An error occurred during the image creation process.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const { summary, results, uiProgressData } = result;
  const progressData = uiProgressData || results;

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const handleDownload = (imageUrl: string, itemName: string) => {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `${itemName.toLowerCase().replace(/\s+/g, '-')}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyImage = async (imageUrl: string) => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob })
      ]);
    } catch (error) {
      console.error('Failed to copy image:', error);
    }
  };

  const renderCreationResult = (item: CreationResult, index: number) => (
    <div key={index} className="border rounded-lg p-4 bg-white">
      <div className="flex items-start gap-4">
        {item.imageUrl ? (
          <div className="flex-shrink-0 relative group">
            <img 
              src={item.imageUrl} 
              alt={item.item}
              className="w-48 h-48 object-cover rounded-lg border"
            />
            {/* Copy/Download buttons overlay */}
            {!isReadonly && (
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex gap-1">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => handleCopyImage(item.imageUrl!)}
                  className="bg-white/90 backdrop-blur-sm p-1 h-6 w-6"
                  title="Copy image"
                >
                  <Copy className="w-3 h-3" />
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => handleDownload(item.imageUrl!, item.item)}
                  className="bg-white/90 backdrop-blur-sm p-1 h-6 w-6"
                  title="Download image"
                >
                  <Download className="w-3 h-3" />
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex-shrink-0 w-48 h-48 bg-gray-100 rounded-lg border flex items-center justify-center">
            <Image className="w-8 h-8 text-gray-400" />
          </div>
        )}
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-medium text-sm text-gray-900 truncate">{item.item}</h4>
            {item.existingAsset && (
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                Existing
              </span>
            )}
            {item.success && !item.existingAsset && (
              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                Created
              </span>
            )}
            {!item.success && (
              <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">
                Failed
              </span>
            )}
          </div>
          
          {item.reasoning && (
            <p className="text-xs text-gray-600 mb-2">{item.reasoning}</p>
          )}
          
          <div className="space-y-2 mt-2">
            {/* Seed Images */}
            {item.seedImagesUsed && item.seedImagesUsed.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-gray-500">
                  <span className="font-medium">Seed Images ({item.seedImagesUsed.length}):</span>
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {item.seedImagesUsed.map((seedUrl, idx) => (
                    <div key={idx} className="relative aspect-square rounded border bg-gray-50 overflow-hidden group">
                      <img 
                        src={seedUrl} 
                        alt={`Seed ${idx + 1}`}
                        className="w-full h-full object-cover cursor-pointer transition-transform group-hover:scale-105"
                        title={`Seed image ${idx + 1}`}
                      />
                      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-opacity flex items-center justify-center">
                        <Eye className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Approach */}
            {item.approach && (
              <p className="text-xs text-gray-500">
                <span className="font-medium">Approach:</span> {item.approach}
              </p>
            )}
            
            {/* Prompt */}
            {item.prompt && (
              <details className="text-xs">
                <summary className="cursor-pointer text-gray-500 hover:text-gray-700 flex items-center gap-1">
                  <Eye className="w-3 h-3" />
                  View prompt
                </summary>
                <div className="mt-2 text-gray-600 bg-gray-50 p-3 rounded border text-[10px] leading-relaxed">
                  <div className="font-medium text-gray-700 mb-1">Generated Prompt:</div>
                  <p className="font-mono">{item.prompt}</p>
                </div>
              </details>
            )}
          </div>
          
          {item.error && (
            <p className="text-xs text-red-600 mt-1 bg-red-50 p-2 rounded">
              {item.error}
            </p>
          )}
        </div>
      </div>
    </div>
  );

  const renderSection = (
    title: string,
    icon: React.ReactNode,
    items: CreationResult[],
    sectionKey: string,
    bgColor: string,
    borderColor: string
  ) => {
    const isExpanded = expandedSection === sectionKey;
    const successfulItems = items.filter(item => item.success);
    
    return (
      <div className={`border rounded-lg ${borderColor}`}>
        <button
          onClick={() => toggleSection(sectionKey)}
          className={`w-full p-3 ${bgColor} rounded-t-lg hover:opacity-80 transition-opacity`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {icon}
              <span className="font-medium text-sm">{title}</span>
              <span className="text-xs opacity-75">
                ({successfulItems.length}/{items.length})
              </span>
            </div>
            {isExpanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </div>
        </button>
        
        {isExpanded && (
          <div className="p-3 space-y-3 bg-white rounded-b-lg">
            {items.length > 0 ? (
              items.map((item, index) => renderCreationResult(item, index))
            ) : (
              <p className="text-xs text-gray-500 italic">No items in this category</p>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="w-fit max-w-full space-y-3">
      {/* Summary Card */}
      <div className="border rounded-lg p-4 bg-green-50 border-green-200">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-green-100 rounded-full">
            <Palette className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <h3 className="font-semibold text-sm text-green-800">
              Structured Image Creation Complete
            </h3>
            <p className="text-xs text-green-600 mt-1">
              Created {summary.totalImagesCreated} images systematically
            </p>
            <div className="flex gap-4 mt-2 text-xs text-green-700">
              <span>Characters: {summary.charactersCreated}</span>
              <span>Environments: {summary.environmentsCreated}</span>
              <span>Scenes: {summary.scenesCreated}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Results */}
      <div className="space-y-2">
        {renderSection(
          'Character Portraits',
          <Users className="w-4 h-4" />,
          progressData.characterPortraits,
          'characters',
          'bg-blue-50',
          'border-blue-200'
        )}
        
        {renderSection(
          'Environments',
          <MapPin className="w-4 h-4" />,
          progressData.environments,
          'environments',
          'bg-purple-50',
          'border-purple-200'
        )}
        
        {renderSection(
          'Scene Compositions',
          <Sparkles className="w-4 h-4" />,
          progressData.scenes,
          'scenes',
          'bg-orange-50',
          'border-orange-200'
        )}
      </div>

      {/* Approval Gate */}
      {result.needsApproval && !isReadonly && (
        <div className="border rounded-lg p-4 bg-yellow-50 border-yellow-200">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-yellow-100 rounded-full">
              <Check className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-yellow-800">
                {result.needsApproval === 'characters' ? 'Character Approval Required' : 'Environment Approval Required'}
              </h3>
              <p className="text-xs text-yellow-600 mt-1">
                Please review the {result.needsApproval} above and approve to continue.
              </p>
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button 
              size="sm" 
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={() => {
                // This would trigger the next phase
                console.log(`Approved ${result.needsApproval}`);
              }}
            >
              <Check className="w-4 h-4 mr-1" />
              Approve & Continue
            </Button>
            <Button 
              size="sm" 
              variant="outline"
              className="border-red-200 text-red-600 hover:bg-red-50"
              onClick={() => {
                // This would cancel or request changes
                console.log(`Rejected ${result.needsApproval}`);
              }}
            >
              <X className="w-4 h-4 mr-1" />
              Request Changes
            </Button>
          </div>
        </div>
      )}

      {/* Next Steps */}
      {result.nextSteps && (
        <div className="text-xs text-gray-600 bg-gray-50 p-3 rounded border">
          <span className="font-medium">Next Steps:</span> {result.nextSteps}
        </div>
      )}
    </div>
  );
}
