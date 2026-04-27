import { useRef, useState } from "react";
import { useLocation, Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import {
  useCreateLeads,
  useAddContactToLead,
  getListLeadsQueryKey,
  getGetLeadStatsQueryKey,
} from "@workspace/api-client-react";
import type { DuplicateConflict } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeft,
  Plus,
  Upload,
  FileDown,
  FileText,
  AlertTriangle,
  UserPlus,
  SkipForward,
  CheckCircle2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { downloadCsvTemplate, parseLeadsCsv } from "@/lib/csv";

const singleLeadSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.string().email("Valid email required"),
  company: z.string().min(2, "Company is required"),
  propertyAddress: z.string().min(5, "Address is required"),
  city: z.string().min(2, "City is required"),
  state: z.string().min(2, "State is required"),
  country: z.string().min(2, "Country is required").default("USA"),
});

type ResultSummary = {
  created: number;
  skipped: Array<{ name: string; email: string }>;
  conflicts: DuplicateConflict[];
};

function ConflictPanel({
  conflicts,
  skipped,
  onDone,
}: {
  conflicts: DuplicateConflict[];
  skipped: Array<{ name: string; email: string }>;
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const addContact = useAddContactToLead();
  const [resolved, setResolved] = useState<Record<string, "merged" | "skipped">>(
    {},
  );

  const allResolved = conflicts.every((c) => resolved[c.incomingEmail]);

  const handleMerge = (conflict: DuplicateConflict) => {
    addContact.mutate(
      {
        leadId: conflict.existingLeadId,
        data: { name: conflict.incomingName, email: conflict.incomingEmail, outreachSentAt: null },
      },
      {
        onSuccess: () => {
          setResolved((prev) => ({ ...prev, [conflict.incomingEmail]: "merged" }));
          queryClient.invalidateQueries({ queryKey: getListLeadsQueryKey() });
          toast.success(`${conflict.incomingName} added as additional contact`);
        },
        onError: (err) => {
          toast.error("Failed to merge contact", {
            description: err instanceof Error ? err.message : "Unknown error",
          });
        },
      },
    );
  };

  const handleSkip = (conflict: DuplicateConflict) => {
    setResolved((prev) => ({ ...prev, [conflict.incomingEmail]: "skipped" }));
  };

  return (
    <div className="space-y-4 mt-6">
      {skipped.length > 0 && (
        <Card className="border-blue-200 bg-blue-50/50">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-blue-500" />
              <CardTitle className="text-base text-blue-800">
                {skipped.length} exact duplicate{skipped.length === 1 ? "" : "s"} skipped
              </CardTitle>
            </div>
            <CardDescription className="text-blue-700">
              These emails are already in your pipeline — no action needed.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1">
              {skipped.map((s) => (
                <li key={s.email} className="flex items-center gap-2 text-sm text-blue-800">
                  <span className="font-medium">{s.name}</span>
                  <span className="text-blue-600 font-mono text-xs">{s.email}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {conflicts.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              <CardTitle className="text-base text-amber-800">
                {conflicts.length} address conflict{conflicts.length === 1 ? "" : "s"} — action needed
              </CardTitle>
            </div>
            <CardDescription className="text-amber-700">
              These leads share a property address with an existing contact. Merge them to track multiple decision-makers at one property, or skip.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {conflicts.map((c) => {
              const status = resolved[c.incomingEmail];
              return (
                <div
                  key={c.incomingEmail}
                  className={`border rounded-lg p-4 bg-white transition-opacity ${
                    status ? "opacity-60" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-2 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Incoming
                        </span>
                        <span className="font-medium text-sm">{c.incomingName}</span>
                        <span className="font-mono text-xs text-muted-foreground">{c.incomingEmail}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Existing
                        </span>
                        <span className="font-medium text-sm">{c.existingLeadName}</span>
                        <span className="font-mono text-xs text-muted-foreground">{c.existingLeadEmail}</span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <span>Property:</span>
                        <span className="font-medium text-foreground">{c.propertyAddress}</span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 shrink-0">
                      {!status ? (
                        <>
                          <Button
                            size="sm"
                            onClick={() => handleMerge(c)}
                            disabled={addContact.isPending}
                            className="gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white"
                          >
                            <UserPlus className="h-3.5 w-3.5" />
                            Merge
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleSkip(c)}
                          >
                            <SkipForward className="h-3.5 w-3.5 mr-1" />
                            Skip
                          </Button>
                        </>
                      ) : status === "merged" ? (
                        <Badge className="bg-green-100 text-green-800 border-green-200">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Merged
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Skipped</Badge>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {allResolved && (
              <div className="flex justify-end pt-2">
                <Button onClick={onDone} className="bg-indigo-600 hover:bg-indigo-700">
                  Done — View Leads
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {conflicts.length === 0 && skipped.length > 0 && (
        <div className="flex justify-end">
          <Button onClick={onDone} className="bg-indigo-600 hover:bg-indigo-700">
            View Leads
          </Button>
        </div>
      )}
    </div>
  );
}

export default function AddLeads() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const createLeads = useCreateLeads();
  const [bulkInput, setBulkInput] = useState("");
  const [csvFileName, setCsvFileName] = useState<string | null>(null);
  const [csvPreview, setCsvPreview] = useState<{
    leads: Array<{ name: string; email: string; company: string }>;
    total: number;
    errors: string[];
  } | null>(null);
  const [csvText, setCsvText] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<ResultSummary | null>(null);

  const form = useForm<z.infer<typeof singleLeadSchema>>({
    resolver: zodResolver(singleLeadSchema),
    defaultValues: {
      name: "",
      email: "",
      company: "",
      propertyAddress: "",
      city: "",
      state: "",
      country: "USA",
    },
  });

  const invalidateLeads = () => {
    queryClient.invalidateQueries({ queryKey: getListLeadsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetLeadStatsQueryKey() });
  };

  const handleResult = (
    data: { leads: unknown[]; skipped: Array<{ name: string; email: string }>; conflicts: DuplicateConflict[] },
    defaultLabel: string,
  ) => {
    invalidateLeads();
    const hasIssues = data.skipped.length > 0 || data.conflicts.length > 0;

    if (data.leads.length > 0) {
      const msg =
        data.leads.length === 1
          ? `${defaultLabel} added`
          : `${data.leads.length} leads added`;
      toast.success(msg);
    }

    if (!hasIssues) {
      setLocation("/leads");
      return;
    }

    setResult({
      created: data.leads.length,
      skipped: data.skipped,
      conflicts: data.conflicts,
    });
  };

  const onSubmitSingle = (values: z.infer<typeof singleLeadSchema>) => {
    createLeads.mutate(
      { data: { leads: [values] } },
      {
        onSuccess: (data) => handleResult(data, values.name),
        onError: (err) => {
          toast.error("Failed to create lead", {
            description: err instanceof Error ? err.message : "Unknown error",
          });
        },
      },
    );
  };

  const submitBatch = (
    leads: Array<{
      name: string;
      email: string;
      company: string;
      propertyAddress: string;
      city: string;
      state: string;
      country: string;
    }>,
    label: string,
  ) => {
    createLeads.mutate(
      { data: { leads, batchLabel: label } },
      {
        onSuccess: (data) => handleResult(data, label),
        onError: (err) => {
          toast.error("Failed to upload batch", {
            description: err instanceof Error ? err.message : "Unknown error",
          });
        },
      },
    );
  };

  const onSubmitBulk = () => {
    if (!bulkInput.trim()) {
      toast.error("Please paste some data");
      return;
    }
    const { leads, errors } = parseLeadsCsv(bulkInput);
    if (errors.length > 0 && leads.length === 0) {
      toast.error("Could not parse pasted data", { description: errors[0] });
      return;
    }
    if (errors.length > 0) {
      toast.warning(`${errors.length} row(s) skipped`, {
        description: errors.slice(0, 3).join("; "),
      });
    }
    submitBatch(
      leads,
      `Pasted ${new Date().toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} (${leads.length} leads)`,
    );
  };

  const handleFile = async (file: File) => {
    setCsvFileName(file.name);
    const text = await file.text();
    setCsvText(text);
    const { leads, errors } = parseLeadsCsv(text);
    setCsvPreview({
      leads: leads.slice(0, 5).map((l) => ({
        name: l.name,
        email: l.email,
        company: l.company,
      })),
      total: leads.length,
      errors,
    });
  };

  const onCsvFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await handleFile(file);
  };

  const onCsvSubmit = () => {
    if (!csvText) {
      toast.error("Choose a CSV file first");
      return;
    }
    const { leads, errors } = parseLeadsCsv(csvText);
    if (leads.length === 0) {
      toast.error("No valid rows in this file", {
        description: errors[0] ?? "Check your CSV format",
      });
      return;
    }
    if (errors.length > 0) {
      toast.warning(`${errors.length} row(s) skipped`, {
        description: errors.slice(0, 3).join("; "),
      });
    }
    submitBatch(leads, csvFileName || `CSV upload (${leads.length} leads)`);
  };

  const onDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.name.endsWith(".csv")) {
      await handleFile(file);
    } else {
      toast.error("Please drop a .csv file");
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/leads">
          <button
            className="flex h-9 w-9 items-center justify-center rounded-xl border transition-colors"
            style={{ background: "#ffffff", borderColor: "#E5E0F5", color: "#6B7280" }}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        </Link>
        <p className="text-sm" style={{ color: "#6B6580" }}>
          Add a single lead, paste a list, or upload a CSV. Bulk uploads are tagged as a batch.
        </p>
      </div>

      <Tabs defaultValue="single" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-8">
          <TabsTrigger value="single">Single Lead</TabsTrigger>
          <TabsTrigger value="csv">Upload CSV</TabsTrigger>
          <TabsTrigger value="bulk">Bulk Paste</TabsTrigger>
        </TabsList>

        <TabsContent value="single">
          <Card>
            <CardHeader>
              <CardTitle>Manual Entry</CardTitle>
              <CardDescription>
                Add a single lead to the pipeline.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(onSubmitSingle)}
                  className="space-y-6"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Full Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Jane Doe" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email Address</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="jane@property.com"
                              type="email"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="company"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Company / Property Group</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Equity Residential"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="propertyAddress"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Property Address</FormLabel>
                          <FormControl>
                            <Input placeholder="123 Main St" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="city"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>City</FormLabel>
                          <FormControl>
                            <Input placeholder="San Francisco" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="state"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>State</FormLabel>
                            <FormControl>
                              <Input placeholder="CA" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="country"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Country</FormLabel>
                            <FormControl>
                              <Input placeholder="USA" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                  <div className="flex justify-end pt-4">
                    <Button
                      type="submit"
                      disabled={createLeads.isPending}
                      size="lg"
                    >
                      {createLeads.isPending ? "Adding..." : "Add Lead"}
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="csv">
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle>Upload CSV</CardTitle>
                  <CardDescription>
                    Upload a CSV file. Required columns:{" "}
                    <code className="px-1 py-0.5 bg-muted rounded text-xs">
                      name, email, company, propertyAddress, city, state, country
                    </code>
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={downloadCsvTemplate}
                >
                  <FileDown className="h-4 w-4 mr-2" />
                  Template
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={onDrop}
                className="border-2 border-dashed rounded-lg p-12 text-center cursor-pointer hover:bg-muted/40 transition-colors"
              >
                <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                <p className="font-medium">
                  Click to choose or drag a .csv file here
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  All rows uploaded together will be tagged as one batch.
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={onCsvFileChange}
                />
              </div>

              {csvFileName && csvPreview && (
                <div className="border rounded-lg p-4 space-y-3 bg-muted/20">
                  <div className="flex items-center gap-2 text-sm">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{csvFileName}</span>
                    <span className="text-muted-foreground">
                      · {csvPreview.total} valid row
                      {csvPreview.total === 1 ? "" : "s"}
                    </span>
                  </div>

                  {csvPreview.errors.length > 0 && (
                    <div className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded p-2 border border-amber-200 dark:border-amber-800">
                      {csvPreview.errors.length} issue
                      {csvPreview.errors.length === 1 ? "" : "s"} detected:
                      <ul className="mt-1 list-disc list-inside">
                        {csvPreview.errors.slice(0, 5).map((err, i) => (
                          <li key={i}>{err}</li>
                        ))}
                        {csvPreview.errors.length > 5 && (
                          <li>+{csvPreview.errors.length - 5} more</li>
                        )}
                      </ul>
                    </div>
                  )}

                  {csvPreview.leads.length > 0 && (
                    <div className="text-xs">
                      <div className="text-muted-foreground mb-1">Preview:</div>
                      <ul className="space-y-1 font-mono">
                        {csvPreview.leads.map((l, i) => (
                          <li key={i} className="truncate">
                            {l.name} · {l.email} · {l.company}
                          </li>
                        ))}
                        {csvPreview.total > csvPreview.leads.length && (
                          <li className="text-muted-foreground">
                            +{csvPreview.total - csvPreview.leads.length} more
                          </li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                {csvFileName && (
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setCsvFileName(null);
                      setCsvPreview(null);
                      setCsvText("");
                      if (fileInputRef.current)
                        fileInputRef.current.value = "";
                    }}
                  >
                    Clear
                  </Button>
                )}
                <Button
                  onClick={onCsvSubmit}
                  disabled={
                    createLeads.isPending ||
                    !csvPreview ||
                    csvPreview.total === 0
                  }
                  size="lg"
                >
                  <Upload className="mr-2 h-4 w-4" />
                  {createLeads.isPending
                    ? "Uploading..."
                    : csvPreview
                      ? `Upload ${csvPreview.total} leads as batch`
                      : "Upload CSV"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bulk">
          <Card>
            <CardHeader>
              <CardTitle>Bulk Paste</CardTitle>
              <CardDescription>
                Paste CSV data directly. First row may be a header. All rows
                pasted at once are saved as one batch.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder={`name,email,company,propertyAddress,city,state,country\nJohn Smith,john@example.com,Greystar,456 Oak Ave,Austin,TX,USA\nSarah Connor,sarah@bldgs.com,Bozzuto,789 Pine St,Denver,CO,USA`}
                className="min-h-[300px] font-mono text-sm"
                value={bulkInput}
                onChange={(e) => setBulkInput(e.target.value)}
              />
              <div className="flex justify-end pt-2">
                <Button
                  onClick={onSubmitBulk}
                  disabled={createLeads.isPending || !bulkInput.trim()}
                  size="lg"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  {createLeads.isPending ? "Processing..." : "Add as Batch"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {result && (result.skipped.length > 0 || result.conflicts.length > 0) && (
        <ConflictPanel
          conflicts={result.conflicts}
          skipped={result.skipped}
          onDone={() => setLocation("/leads")}
        />
      )}
    </div>
  );
}
