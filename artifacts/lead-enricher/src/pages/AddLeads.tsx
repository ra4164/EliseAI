import { useRef, useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import {
  useCreateLeads,
  getListLeadsQueryKey,
  getGetLeadStatsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, Plus, Upload, FileDown, FileText } from "lucide-react";

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
import { Link } from "wouter";
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

  const onSubmitSingle = (values: z.infer<typeof singleLeadSchema>) => {
    createLeads.mutate(
      { data: { leads: [values] } },
      {
        onSuccess: () => {
          toast.success("Lead created successfully");
          queryClient.invalidateQueries({ queryKey: getListLeadsQueryKey() });
          queryClient.invalidateQueries({
            queryKey: getGetLeadStatsQueryKey(),
          });
          setLocation("/leads");
        },
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
        onSuccess: () => {
          toast.success(`Added ${leads.length} leads to batch "${label}"`);
          queryClient.invalidateQueries({ queryKey: getListLeadsQueryKey() });
          queryClient.invalidateQueries({
            queryKey: getGetLeadStatsQueryKey(),
          });
          setLocation("/leads");
        },
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

  const onCsvFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
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
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4 mb-8">
        <Link href="/leads">
          <Button variant="ghost" size="icon" className="rounded-full">
            <ChevronLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Add New Leads</h1>
          <p className="text-muted-foreground mt-1">
            Add a single lead, paste a list, or upload a CSV file. Bulk uploads
            are tagged as a batch so you can group them later.
          </p>
        </div>
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
    </div>
  );
}
