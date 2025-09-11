import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Search, 
  Users, 
  MapPin, 
  Image as ImageIcon, 
  Film, 
  Package, 
  Eye,
  Download,
  Copy,
  Calendar
} from 'lucide-react';
import { toast } from 'sonner';
import Image from 'next/image';

interface SearchBookPropsResultProps {
  result: {
    props: Array<{
      id: string;
      bookId: string;
      bookTitle: string;
      type: string;
      name: string;
      description?: string;
      hasImage: boolean;
      imageUrl?: string;
      metadata?: any;
      createdAt: string;
    }>;
    summary: {
      totalProps: number;
      characters: number;
      illustrations: number;
      environments: number;
      objects: number;
      other: number;
    };
  };
  isReadonly?: boolean;
}

const getTypeIcon = (type: string) => {
  switch (type) {
    case 'character':
      return <Users className="w-4 h-4" />;
    case 'environment':
      return <MapPin className="w-4 h-4" />;
    case 'illustration':
      return <ImageIcon className="w-4 h-4" />;
    case 'scene':
      return <Film className="w-4 h-4" />;
    case 'object':
    case 'prop':
      return <Package className="w-4 h-4" />;
    default:
      return <ImageIcon className="w-4 h-4" />;
  }
};

const getTypeColor = (type: string) => {
  switch (type) {
    case 'character':
      return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'environment':
      return 'bg-green-50 text-green-700 border-green-200';
    case 'illustration':
      return 'bg-purple-50 text-purple-700 border-purple-200';
    case 'scene':
      return 'bg-orange-50 text-orange-700 border-orange-200';
    case 'object':
    case 'prop':
      return 'bg-gray-50 text-gray-700 border-gray-200';
    default:
      return 'bg-gray-50 text-gray-700 border-gray-200';
  }
};

export function SearchBookPropsResult({ result, isReadonly = false }: SearchBookPropsResultProps) {
  const [selectedTab, setSelectedTab] = useState('all');

  const handleCopyImage = async (imageUrl: string, name: string) => {
    try {
      await navigator.clipboard.writeText(imageUrl);
      toast.success(`${name} image URL copied to clipboard`);
    } catch (error) {
      toast.error('Failed to copy image URL');
    }
  };

  const handleDownload = (imageUrl: string, name: string, type: string) => {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `${name}-${type}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filterProps = (type: string) => {
    if (type === 'all') return result.props;
    return result.props.filter(prop => prop.type === type);
  };

  const PropCard = ({ prop }: { prop: typeof result.props[0] }) => (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* Image */}
          <div className="flex-shrink-0">
            {prop.hasImage && prop.imageUrl ? (
              <div className="relative group">
                <Image
                  src={prop.imageUrl}
                  alt={prop.name}
                  width={80}
                  height={80}
                  className="rounded-lg object-cover border"
                />
                {!isReadonly && (
                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 rounded-lg transition-all duration-200 flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleCopyImage(prop.imageUrl!, prop.name)}
                        className="h-6 w-6 p-0 bg-white/90 hover:bg-white"
                      >
                        <Copy className="w-3 h-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleDownload(prop.imageUrl!, prop.name, prop.type)}
                        className="h-6 w-6 p-0 bg-white/90 hover:bg-white"
                      >
                        <Download className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="w-20 h-20 bg-gray-100 rounded-lg flex items-center justify-center border">
                {getTypeIcon(prop.type)}
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-gray-900 truncate">{prop.name}</h3>
                <Badge variant="outline" className={`text-xs ${getTypeColor(prop.type)}`}>
                  {getTypeIcon(prop.type)}
                  <span className="ml-1">{prop.type}</span>
                </Badge>
              </div>
            </div>

            <div className="text-xs text-gray-500 mb-2">
              <span className="font-medium">{prop.bookTitle}</span>
            </div>

            {prop.description && (
              <p className="text-sm text-gray-600 line-clamp-2 mb-2">
                {prop.description}
              </p>
            )}

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1 text-xs text-gray-400">
                <Calendar className="w-3 h-3" />
                {new Date(prop.createdAt).toLocaleDateString()}
              </div>
              {prop.hasImage && (
                <Badge variant="secondary" className="text-xs">
                  <ImageIcon className="w-3 h-3 mr-1" />
                  Has Image
                </Badge>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <Card className="border-blue-200 bg-blue-50">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-blue-900">
          <Search className="w-5 h-5" />
          Book Props Search Results
        </CardTitle>
        
        {/* Summary */}
        <div className="flex flex-wrap gap-2 mt-2">
          <Badge variant="outline" className="bg-white">
            Total: {result.summary.totalProps}
          </Badge>
          {result.summary.characters > 0 && (
            <Badge variant="outline" className="bg-blue-50 text-blue-700">
              <Users className="w-3 h-3 mr-1" />
              {result.summary.characters} Characters
            </Badge>
          )}
          {result.summary.environments > 0 && (
            <Badge variant="outline" className="bg-green-50 text-green-700">
              <MapPin className="w-3 h-3 mr-1" />
              {result.summary.environments} Environments
            </Badge>
          )}
          {result.summary.illustrations > 0 && (
            <Badge variant="outline" className="bg-purple-50 text-purple-700">
              <ImageIcon className="w-3 h-3 mr-1" />
              {result.summary.illustrations} Illustrations
            </Badge>
          )}
          {result.summary.other > 0 && (
            <Badge variant="outline" className="bg-orange-50 text-orange-700">
              <Film className="w-3 h-3 mr-1" />
              {result.summary.other} Scenes/Other
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent>
        <Tabs value={selectedTab} onValueChange={setSelectedTab}>
          <TabsList className="grid w-full grid-cols-6 bg-white">
            <TabsTrigger value="all" className="text-xs">
              All ({result.summary.totalProps})
            </TabsTrigger>
            <TabsTrigger value="character" className="text-xs" disabled={result.summary.characters === 0}>
              Characters ({result.summary.characters})
            </TabsTrigger>
            <TabsTrigger value="environment" className="text-xs" disabled={result.summary.environments === 0}>
              Environments ({result.summary.environments})
            </TabsTrigger>
            <TabsTrigger value="illustration" className="text-xs" disabled={result.summary.illustrations === 0}>
              Illustrations ({result.summary.illustrations})
            </TabsTrigger>
            <TabsTrigger value="scene" className="text-xs" disabled={result.summary.other === 0}>
              Scenes ({result.summary.other})
            </TabsTrigger>
            <TabsTrigger value="object" className="text-xs" disabled={result.summary.objects === 0}>
              Objects ({result.summary.objects})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-4">
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {result.props.map((prop) => (
                <PropCard key={prop.id} prop={prop} />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="character" className="mt-4">
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {filterProps('character').map((prop) => (
                <PropCard key={prop.id} prop={prop} />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="environment" className="mt-4">
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {filterProps('environment').map((prop) => (
                <PropCard key={prop.id} prop={prop} />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="illustration" className="mt-4">
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {filterProps('illustration').map((prop) => (
                <PropCard key={prop.id} prop={prop} />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="scene" className="mt-4">
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {filterProps('scene').map((prop) => (
                <PropCard key={prop.id} prop={prop} />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="object" className="mt-4">
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {filterProps('object').map((prop) => (
                <PropCard key={prop.id} prop={prop} />
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
