import { Badge } from './ui/badge';

function ParameterDisplay({ name, type, description, required }) {
  return (
    <div className="p-3 bg-muted/50 rounded-lg border">
      <div className="flex items-center gap-2 mb-1">
        <code className="text-sm font-medium">{name}</code>
        <Badge variant="outline" className="text-xs">
          {type}
        </Badge>
        {required && (
          <Badge variant="destructive" className="text-xs">
            必填
          </Badge>
        )}
      </div>
      {description && (
        <p className="text-xs text-muted-foreground mt-1">
          {description}
        </p>
      )}
    </div>
  );
}

export default ParameterDisplay;
