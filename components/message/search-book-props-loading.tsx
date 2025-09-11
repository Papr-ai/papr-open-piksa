import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, Loader2 } from 'lucide-react';

interface SearchBookPropsLoadingProps {
  searchType: string;
  searchValue: string;
}

export function SearchBookPropsLoading({ searchType, searchValue }: SearchBookPropsLoadingProps) {
  const getSearchDescription = () => {
    switch (searchType) {
      case 'bookId':
        return `Searching props for book ID: ${searchValue}`;
      case 'bookTitle':
        return `Searching props for book: "${searchValue}"`;
      case 'type':
        return `Searching all ${searchValue} props`;
      case 'all':
        return 'Searching all book props';
      default:
        return `Searching props: ${searchValue}`;
    }
  };

  return (
    <Card className="border-blue-200 bg-blue-50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-blue-900">
          <Search className="w-5 h-5" />
          Searching Characters & Illustrations
        </CardTitle>
      </CardHeader>
      
      <CardContent>
        <div className="flex items-center gap-3">
          <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
          <div>
            <p className="text-sm font-medium text-blue-900">
              {getSearchDescription()}
            </p>
            <p className="text-xs text-blue-700 mt-1">
              Looking through characters, environments, illustrations, and scenes...
            </p>
          </div>
        </div>
        
        <div className="mt-3 flex gap-2">
          <Badge variant="outline" className="bg-white animate-pulse">
            <div className="w-3 h-3 bg-blue-200 rounded mr-2"></div>
            Characters
          </Badge>
          <Badge variant="outline" className="bg-white animate-pulse">
            <div className="w-3 h-3 bg-green-200 rounded mr-2"></div>
            Environments  
          </Badge>
          <Badge variant="outline" className="bg-white animate-pulse">
            <div className="w-3 h-3 bg-purple-200 rounded mr-2"></div>
            Illustrations
          </Badge>
          <Badge variant="outline" className="bg-white animate-pulse">
            <div className="w-3 h-3 bg-orange-200 rounded mr-2"></div>
            Scenes
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
