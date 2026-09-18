import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, RefreshCw, Home, ChevronDown, ChevronUp } from 'lucide-react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null, showDetails: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary caught an error]:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onReset) {
      this.props.onReset();
    } else {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-[50vh] flex items-center justify-center p-4">
          <Card className="max-w-lg w-full border-destructive/30 shadow-lg">
            <CardHeader className="text-center pb-2">
              <div className="w-12 h-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto mb-3">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <CardTitle className="text-xl font-bold text-foreground">
                {this.props.title || 'Something went wrong'}
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                An unexpected error occurred while rendering this page.
              </p>
            </CardHeader>
            <CardContent className="space-y-4 pt-2">
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button onClick={this.handleReset} variant="default" className="gap-2">
                  <RefreshCw className="w-4 h-4" />
                  Reload Page
                </Button>
                <Button
                  onClick={() => {
                    window.location.href = '/';
                  }}
                  variant="outline"
                  className="gap-2"
                >
                  <Home className="w-4 h-4" />
                  Go to Dashboard
                </Button>
              </div>

              {this.state.error && (
                <div className="pt-2 border-t border-border">
                  <button
                    type="button"
                    onClick={() => this.setState(prev => ({ showDetails: !prev.showDetails }))}
                    className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mx-auto"
                  >
                    {this.state.showDetails ? 'Hide Error Details' : 'View Error Details'}
                    {this.state.showDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>

                  {this.state.showDetails && (
                    <div className="mt-3 p-3 bg-muted rounded-lg text-xs font-mono text-muted-foreground overflow-auto max-h-48 whitespace-pre-wrap">
                      <p className="font-bold text-destructive mb-1">
                        {this.state.error.toString()}
                      </p>
                      {this.state.errorInfo?.componentStack}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
