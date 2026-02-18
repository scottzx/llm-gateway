import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from './ui/dialog';
import ParameterDisplay from './ParameterDisplay';

function ToolInfoDialog({ tool, open, onOpenChange }) {
  const parameters = tool.input_schema?.properties || {};
  const required = tool.input_schema?.required || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogClose />
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <code className="text-lg">{tool.name}</code>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* 描述 */}
          <div>
            <h4 className="text-sm font-medium mb-2">描述</h4>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap max-h-40 overflow-y-auto pr-2">
              {tool.description}
            </p>
          </div>

          {/* 参数列表 */}
          {Object.keys(parameters).length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-2">参数</h4>
              <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                {Object.entries(parameters).map(([paramName, paramInfo]) => (
                  <ParameterDisplay
                    key={paramName}
                    name={paramName}
                    type={paramInfo.type}
                    description={paramInfo.description}
                    required={required.includes(paramName)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default ToolInfoDialog;
